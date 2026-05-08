// ==UserScript==
// @name         Mitmachim Top Topic Summarizer - Ultimate Edition
// @namespace    http://mitmachim.top/*
// @version      6.0
// @description  AI topic summarizer: Flash-Lite, Native Hover, Smart Caching, Copy Button & Custom Prompt Editor
// @match        https://mitmachim.top/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_setClipboard
// @connect      generativelanguage.googleapis.com
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // הגדרת הנחיית ברירת המחדל (Default Prompt)
    // ==========================================
    const defaultPromptText = `סכם את הדיון בעברית תקנית, בצורה תמציתית, ברורה ועובדתית.

פורמט הפלט:
- אל תפתח במשפטים כמו "להלן סיכום" או "סיכום הדיון" - גש ישר לתוכן.
- מותר ומומלץ להשתמש ב-Markdown בסיסי בלבד לפי הצורך:
  - **טקסט מודגש** להדגשת מונחים מרכזיים או החלטות.
  - *טקסט נטוי* לשמות, ציטוטים קצרים, או דגשים משניים.
  - רשימה לא ממוספרת עם מקף ורווח (- פריט) כשיש 3 פריטים או יותר באותה קטגוריה.
  - רשימה ממוספרת (1. פריט) כשיש סדר או שלבים.
  - כותרת משנה בסולמית כפולה (## כותרת) רק בדיון ארוך עם כמה נושאים נפרדים.
  - \`קוד\` בגרשיים אחוריים לפקודות, שמות קבצים, או מונחים טכניים.
  - קישורים בפורמט [תיאור](כתובת) רק אם הופיעו במקור.
- אל תשתמש בטבלאות, ב-blockquote (>), בקווי הפרדה (---), או ברשימות מקוננות.
- הפרד בין פסקאות בשורה ריקה.

תוכן הסיכום:
- התחל מהנושא המרכזי של הדיון.
- המשך לנקודות העיקריות, נקודות מחלוקת או הסכמה, ופרטים מהותיים.
- סיים במסקנה, החלטה, או בסטטוס הנוכחי - אם קיים.
- ציין שם משתמש רק אם זהותו מהותית להבנת הדיון. אחרת השתמש ב"משתמש" או "משתתף".
- אל תמציא מידע שאינו מופיע בטקסט. אם משהו לא ברור, דלג עליו.
- אורך: 3 עד 6 משפטים, או 2 עד 4 פריטים ברשימה אם הדיון מנייתי באופיו.`;

    // עיצוב החלונית
    const customStyles = `
        @media (min-width: 768px) {
            .ai-summary-dialog .modal-dialog {
                width: 85% !important;
                max-width: 800px !important;
            }
        }
    `;
    const styleSheet = document.createElement("style");
    styleSheet.innerText = customStyles;
    document.head.appendChild(styleSheet);

    // ניהול מפתח API
    function getApiKey() {
        let key = GM_getValue('gemini_api_key_v2');
        if (!key) {
            key = prompt('אנא הכנס את מפתח ה-Gemini API שלך (הוא יישמר מקומית בדפדפן):');
            if (key) GM_setValue('gemini_api_key_v2', key);
        }
        return key;
    }

    // המרת תווים מיוחדים למניעת חדירת קוד זדוני (XSS Protection)
    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, function(tag) {
            const charsToReplace = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            };
            return charsToReplace[tag] || tag;
        });
    }

    // המרת מארקדאון מורחב ל-HTML תקני (תמיכה בהנחיה החדשה)
    function formatSummaryText(text) {
        let html = escapeHTML(text);

        // כותרות משנה
        html = html.replace(/^### (.*?)$/gm, '<h4 style="margin-top:15px; margin-bottom:5px; color:#202124;"><strong>$1</strong></h4>');
        html = html.replace(/^## (.*?)$/gm, '<h3 style="margin-top:15px; margin-bottom:5px; color:#202124;"><strong>$1</strong></h3>');
        html = html.replace(/^# (.*?)$/gm, '<h2 style="margin-top:15px; margin-bottom:5px; color:#202124;"><strong>$1</strong></h2>');

        // רשימות לא ממוספרות (כוכבית או מקף)
        html = html.replace(/^[\*\-]\s+(.*)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>(?:\n<li>.*<\/li>)*)/g, '<ul style="padding-right: 25px; margin-bottom: 15px; margin-top: 5px;">$1</ul>');

        // רשימות ממוספרות (מספר ונקודה)
        html = html.replace(/^\d+\.\s+(.*)$/gm, '<li class="ol-item">$1</li>');
        html = html.replace(/(<li class="ol-item">.*<\/li>(?:\n<li class="ol-item">.*<\/li>)*)/g, '<ol style="padding-right: 25px; margin-bottom: 15px; margin-top: 5px;">$1</ol>');
        html = html.replace(/class="ol-item"/g, '');

        // עיצובי טקסט מובלעים (Bold, Italic)
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*([^\*]+)\*/g, '<em>$1</em>');

        // קוד inline (Inline Code)
        html = html.replace(/`(.*?)`/g, '<code style="background:#f1f3f4; padding:2px 5px; border-radius:4px; font-family:monospace; color:#d63384; font-size:90%;">$1</code>');

        // קישורים
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="text-decoration:none; color:#0d6efd;">$1</a>');

        // רווחים ושבירת שורות
        html = html.replace(/\n\n/g, '<br><br>');
        html = html.replace(/\n/g, '<br>');

        // ניקוי <br> מיותרים
        html = html.replace(/<br><ul/g, '<ul').replace(/<\/ul><br>/g, '</ul>');
        html = html.replace(/<br><ol/g, '<ol').replace(/<\/ol><br>/g, '</ol>');
        html = html.replace(/<\/li><br>/g, '</li>');

        return html;
    }

    // פתיחת חלונית לעריכת ההנחיה
    function showPromptEditor(tid, cacheKey) {
        const bootbox = window.bootbox || unsafeWindow.bootbox;
        const currentPrompt = GM_getValue('custom_ai_prompt_v1') || defaultPromptText;

        bootbox.dialog({
            title: 'הגדרות מתקדמות: התאמת הנחיה (Prompt)',
            message: `
                <div style="direction: rtl; text-align: right;">
                    <p style="margin-bottom: 15px; color: #555; font-size: 14px;">
                        כאן תוכל לערוך את ההוראות שנשלחות לבינה המלאכותית לפני הסיכום.<br>
                        <strong>טיפ:</strong> אם תמחק את כל הטקסט ותשמור, המערכת תחזור אוטומטית להנחיית ברירת המחדל.
                    </p>
                    <textarea id="custom-prompt-textarea" class="form-control" rows="15" style="width: 100%; resize: vertical; font-family: monospace; direction: rtl; font-size: 13px; line-height: 1.5;">${escapeHTML(currentPrompt)}</textarea>
                </div>
            `,
            size: 'large',
            buttons: {
                save: {
                    label: '<i class="fa fa-save"></i> שמור וסכם מחדש',
                    className: 'btn-primary',
                    callback: function() {
                        const newPrompt = document.getElementById('custom-prompt-textarea').value.trim();
                        if (newPrompt) {
                            GM_setValue('custom_ai_prompt_v1', newPrompt);
                        } else {
                            // אם המשתמש רוקן את התיבה, חוזרים לברירת המחדל
                            GM_setValue('custom_ai_prompt_v1', '');
                        }
                        // מחיקת הקאש הקיים כדי להכריח סיכום לפי ההנחיה החדשה
                        localStorage.removeItem(cacheKey);
                        startSummary();
                    }
                },
                cancel: {
                    label: 'ביטול',
                    className: 'btn-default',
                    callback: function() {
                        // חזרה לחלונית הסיכום הרגילה ללא שינוי
                        startSummary();
                    }
                }
            }
        });
    }

    // פעולת הסיכום המרכזית
    async function startSummary() {
        const match = window.location.pathname.match(/\/topic\/(\d+)/);
        const tid = match ? match[1] : null;

        if (!tid) {
            alert('לא ניתן לזהות את מספר הדיון בעמוד זה.');
            return;
        }

        const bootbox = window.bootbox || unsafeWindow.bootbox;
        const $ = window.$ || unsafeWindow.$;

        if (!bootbox || !$) {
            alert('שגיאה: לא הצלחתי להתחבר לממשק הפורום. נסה לרענן את העמוד.');
            return;
        }

        const cacheKey = `ai_summary_tid_${tid}_v3`;
        const cachedSummary = localStorage.getItem(cacheKey);

        // אם יש קאש - מציגים ישירות
        if (cachedSummary) {
            const cachedDialog = bootbox.dialog({
                title: 'סיכום הנושא <span class="badge bg-secondary" style="font-size: 12px; margin-right: 5px;">מתוך הזיכרון</span>',
                message: `<div style="font-size: 15px; line-height: 1.6;">${formatSummaryText(cachedSummary)}</div>`,
                closeButton: true,
                size: 'large',
                className: 'ai-summary-dialog',
                buttons: {
                    copy: {
                        label: '<i class="fa fa-clone"></i> העתק סיכום',
                        className: 'btn-default nbe-copy-btn',
                        callback: function() {
                            GM_setClipboard(cachedSummary);
                            const btn = cachedDialog.find('.nbe-copy-btn');
                            btn.html('<i class="fa fa-check"></i> הועתק').removeClass('btn-default').addClass('btn-success text-white');
                            setTimeout(() => btn.html('<i class="fa fa-clone"></i> העתק סיכום').removeClass('btn-success text-white').addClass('btn-default'), 2000);
                            return false; 
                        }
                    },
                    editPrompt: {
                        label: '<i class="fa fa-sliders"></i> התאמת הנחיה',
                        className: 'btn-default',
                        callback: function() {
                            showPromptEditor(tid, cacheKey);
                            return true; // סוגר את החלונית הנוכחית
                        }
                    },
                    refresh: {
                        label: '<i class="fa fa-refresh"></i> סכם מחדש',
                        className: 'btn-outline-secondary',
                        callback: function() {
                            localStorage.removeItem(cacheKey);
                            startSummary();
                        }
                    },
                    ok: {
                        label: 'סגור',
                        className: 'btn-primary'
                    }
                }
            });
            return;
        }

        const apiKey = getApiKey();
        if (!apiKey) return;

        // חלונית טעינה בעת יצירת סיכום חדש
        const dialog = bootbox.dialog({
            title: 'סיכום הנושא',
            message: '<div class="text-center" style="padding: 20px;"><i class="fa fa-spinner fa-spin fa-2x text-muted"></i><div style="margin-top: 10px; color: #666;">אוסף נתונים ומסכם...</div></div>',
            closeButton: true,
            size: 'large',
            className: 'ai-summary-dialog',
            buttons: {
                copy: { 
                    label: '<i class="fa fa-clone"></i> העתק סיכום', 
                    className: 'btn-default nbe-copy-btn disabled',
                    callback: function() {
                        const rawText = dialog.data('rawSummary');
                        if (rawText) {
                            GM_setClipboard(rawText);
                            const btn = dialog.find('.nbe-copy-btn');
                            btn.html('<i class="fa fa-check"></i> הועתק').removeClass('btn-default').addClass('btn-success text-white');
                            setTimeout(() => btn.html('<i class="fa fa-clone"></i> העתק סיכום').removeClass('btn-success text-white').addClass('btn-default'), 2000);
                        }
                        return false;
                    }
                },
                editPrompt: {
                    label: '<i class="fa fa-sliders"></i> התאמת הנחיה',
                    className: 'btn-default nbe-edit-btn disabled',
                    callback: function() {
                        showPromptEditor(tid, cacheKey);
                        return true;
                    }
                },
                ok: { label: 'סגור', className: 'btn-primary disabled nbe-ok-btn' }
            }
        });

        let threadText = '';

        try {
            const res = await fetch(window.location.origin + `/api/topic/${tid}`);
            const data = await res.json();

            let allPosts = data.posts || [];
            const pageCount = data.pagination ? data.pagination.pageCount : 1;

            for (let p = 2; p <= pageCount; p++) {
                const pageRes = await fetch(window.location.origin + `/api/topic/${tid}?page=${p}`);
                const pageData = await pageRes.json();
                if (pageData.posts) allPosts = allPosts.concat(pageData.posts);
            }

            allPosts.forEach((post, index) => {
                if (post && post.content && !post.deleted) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = post.content;
                    const text = tempDiv.innerText.trim();
                    if (text) threadText += `--- פוסט ${index + 1} ---\n${text}\n\n`;
                }
            });
        } catch (e) {
            console.error('API fetch error', e);
        }

        if (!threadText) {
            dialog.find('.bootbox-body').html('<div class="alert alert-danger">שגיאה: לא הצלחתי לקרוא את תוכן הדיון.</div>');
            dialog.find('.nbe-ok-btn, .nbe-edit-btn').removeClass('disabled');
            return;
        }

        const MAX_CHARS = 80000;
        if (threadText.length > MAX_CHARS) {
            threadText = threadText.substring(0, MAX_CHARS) + "\n...[הטקסט נחתך עקב מגבלת אורך הדיון]...";
        }

        // טעינת ההנחיה המותאמת אישית של המשתמש (אם קיימת), או שימוש בברירת המחדל
        const customPrompt = GM_getValue('custom_ai_prompt_v1') || defaultPromptText;
        const finalPrompt = `${customPrompt}\n\nהנה הפוסטים לסיכום:\n\n${threadText}`;

        GM_xmlhttpRequest({
            method: 'POST',
            url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`,
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify({ contents: [{ parts: [{ text: finalPrompt }] }] }),
            onload: function(response) {
                try {
                    const res = JSON.parse(response.responseText);
                    if (res.error) {
                        if (res.error.code === 400 && res.error?.message?.includes("API key not valid")) {
                            dialog.find('.bootbox-body').html('<div class="alert alert-danger">מפתח ה-API לא תקין. הוא אופס. רענן את העמוד ונסה שוב.</div>');
                            GM_setValue('gemini_api_key_v2', '');
                        } else {
                            dialog.find('.bootbox-body').html(`<div class="alert alert-danger">שגיאה: ${res.error.message}</div>`);
                        }
                    } else if (res.candidates && res.candidates.length > 0) {
                        const summary = res.candidates[0].content.parts[0].text;
                        
                        localStorage.setItem(cacheKey, summary);
                        dialog.data('rawSummary', summary);

                        const formattedHTML = formatSummaryText(summary);
                        dialog.find('.bootbox-body').html(`<div style="font-size: 15px; line-height: 1.6;">${formattedHTML}</div>`);
                        
                        // הדלקת הכפתורים ברגע שהסיכום מוכן
                        dialog.find('.nbe-copy-btn').removeClass('disabled');
                    } else {
                        dialog.find('.bootbox-body').html('<div class="alert alert-warning">התקבלה תשובה ריקה.</div>');
                    }
                } catch (e) {
                    dialog.find('.bootbox-body').html('<div class="alert alert-danger">שגיאה בפענוח התשובה מ-Gemini.</div>');
                }
                // הדלקת כפתורי הפעולות הרגילים בכל מצב של סיום
                dialog.find('.nbe-ok-btn, .nbe-edit-btn').removeClass('disabled');
            },
            onerror: function() {
                dialog.find('.bootbox-body').html('<div class="alert alert-danger">שגיאת תקשורת עם שרתי Google.</div>');
                dialog.find('.nbe-ok-btn, .nbe-edit-btn').removeClass('disabled');
            }
        });
    }

    function cleanupOldButtons() {
        const oldFloatingBtn = document.getElementById('ai-summary-btn');
        if (oldFloatingBtn) oldFloatingBtn.remove();
    }

    function injectInlineButton() {
        let btn = document.getElementById('native-ai-summary-btn');
        if (btn) return;

        const anchorElement = document.querySelector('[component="topic/sort"]') ||
                              document.querySelector('[component="topic/watch"]');

        if (!anchorElement) return;

        const targetContainer = document.querySelector('.sticky-tools .topic-main-buttons > div > div:first-child') ||
                                document.querySelector('.topic-main-buttons > div > div:first-child') ||
                                anchorElement.closest('ul') ||
                                anchorElement.closest('.btn-group') ||
                                anchorElement.parentNode;

        btn = document.createElement('button');
        btn.id = 'native-ai-summary-btn';

        btn.className = 'btn btn-ghost btn-sm ff-secondary d-flex gap-2 align-items-center text-truncate';
        btn.style.cssText = 'order: 999; margin-right: 5px; cursor: pointer; display: inline-flex; border: none; outline: none;';
        btn.innerHTML = '<i class="fa fa-fw fa-magic text-primary"></i> <span class="fw-semibold text-truncate text-nowrap">סכם נושא</span>';

        btn.onclick = (e) => {
            e.preventDefault();
            startSummary();
        };

        targetContainer.appendChild(btn);
        cleanupOldButtons();
    }

    let _observerBusy = false;
    const globalObserver = new MutationObserver(() => {
        if (_observerBusy) return;
        _observerBusy = true;
        try {
            injectInlineButton();
        } finally {
            _observerBusy = false;
        }
    });

    globalObserver.observe(document.body, { childList: true, subtree: true });
    injectInlineButton();

})();
