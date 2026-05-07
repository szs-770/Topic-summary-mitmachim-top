// ==UserScript==
// @name         Mitmachim Top Topic Summarizer - Ultimate Edition
// @namespace    http://mitmachim.top/*
// @version      5.6
// @description  AI topic summarizer with native hover effect, smart caching, strict positioning & Bullet-point formatting
// @match        https://mitmachim.top/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      generativelanguage.googleapis.com
// ==/UserScript==

(function() {
    'use strict';

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

    // המרת מארקדאון ל-HTML תקני (כולל רשימות ונקודות חכמות)
    function formatSummaryText(text) {
        let html = text;

        // הדגשות (Bold)
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // כותרות
        html = html.replace(/### (.*?)(?=\n|$)/g, '<h4 style="margin-top:15px;"><strong>$1</strong></h4>');
        html = html.replace(/## (.*?)(?=\n|$)/g, '<h3 style="margin-top:15px;"><strong>$1</strong></h3>');
        html = html.replace(/# (.*?)(?=\n|$)/g, '<h2 style="margin-top:15px;"><strong>$1</strong></h2>');

        // זיהוי שורות רשימה (מתחילות בכוכבית או מקף רווח) והמרתן ל-<li>
        html = html.replace(/^[\*\-]\s+(.*)$/gm, '<li>$1</li>');

        // עטיפת קבוצות של <li> בתוך <ul> כדי ליצור את הנקודות העגולות בעיצוב
        html = html.replace(/(<li>.*<\/li>(?:\n<li>.*<\/li>)*)/g, '<ul style="padding-right: 25px; margin-bottom: 15px; margin-top: 10px;">$1</ul>');

        // הפיכת שאר ירידות השורה ל-<br>
        html = html.replace(/\n/g, '<br>');

        // ניקוי <br> מיותרים שנוצרו מסביב ובתוך הרשימות
        html = html.replace(/<br><ul/g, '<ul').replace(/<\/ul><br>/g, '</ul>');
        html = html.replace(/<\/li><br>/g, '</li>');

        return html;
    }

    // פעולת הסיכום
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

        const cacheKey = `ai_summary_tid_${tid}_v2`;
        const cachedSummary = localStorage.getItem(cacheKey);

        if (cachedSummary) {
            bootbox.dialog({
                title: 'סיכום הנושא <span class="badge bg-secondary" style="font-size: 12px; margin-right: 5px;">מתוך הזיכרון</span>',
                message: `<div style="font-size: 15px; line-height: 1.6;">${formatSummaryText(cachedSummary)}</div>`,
                closeButton: true,
                size: 'large',
                className: 'ai-summary-dialog',
                buttons: {
                    ok: {
                        label: 'OK',
                        className: 'btn-primary'
                    },
                    refresh: {
                        label: '<i class="fa fa-refresh"></i> סכם מחדש',
                        className: 'btn-outline-secondary',
                        callback: function() {
                            localStorage.removeItem(cacheKey);
                            startSummary();
                        }
                    }
                }
            });
            return;
        }

        const apiKey = getApiKey();
        if (!apiKey) return;

        const dialog = bootbox.dialog({
            title: 'סיכום הנושא',
            message: '<div class="text-center" style="padding: 20px;"><i class="fa fa-spinner fa-spin fa-2x text-muted"></i><div style="margin-top: 10px; color: #666;">אוסף נתונים ומסכם...</div></div>',
            closeButton: true,
            size: 'large',
            className: 'ai-summary-dialog',
            buttons: {
                ok: { label: 'OK', className: 'btn-primary disabled' }
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
            dialog.find('.btn-primary').removeClass('disabled');
            return;
        }

        const promptText = `אתה מומחה בסיכום מידע. קרא את הפוסטים הבאים מתוך דיון בפורום. עליך להחזיר סיכום מלא, ברור ומתומצת של כל הנושא.
החזר את הסיכום *אך ורק* כרשימת נקודות קצרה וקולעת. עבור כל נקודה ברשימה, כתוב מילת נושא או משפט קצר ומודגש, לאחריו נקודתיים, ואז ההסבר.
לדוגמה:
* **נושא הדיון:** הסבר קצר על מה מדובר.
* **נקודה מרכזית:** פירוט הנקודה שהועלתה.

הנה הפוסטים לסיכום:
\n\n${threadText}`;

        GM_xmlhttpRequest({
            method: 'POST',
            url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }),
            onload: function(response) {
                try {
                    const res = JSON.parse(response.responseText);
                    if (res.error) {
                        if (res.error.code === 400 && res.error.message.includes("API key not valid")) {
                            dialog.find('.bootbox-body').html('<div class="alert alert-danger">מפתח ה-API לא תקין. הוא אופס. רענן את העמוד ונסה שוב.</div>');
                            GM_setValue('gemini_api_key_v2', '');
                        } else {
                            dialog.find('.bootbox-body').html(`<div class="alert alert-danger">שגיאה: ${res.error.message}</div>`);
                        }
                    } else if (res.candidates && res.candidates.length > 0) {
                        const summary = res.candidates[0].content.parts[0].text;
                        localStorage.setItem(cacheKey, summary);
                        const formattedHTML = formatSummaryText(summary);
                        dialog.find('.bootbox-body').html(`<div style="font-size: 15px; line-height: 1.6;">${formattedHTML}</div>`);
                    } else {
                        dialog.find('.bootbox-body').html('<div class="alert alert-warning">התקבלה תשובה ריקה.</div>');
                    }
                } catch (e) {
                    dialog.find('.bootbox-body').html('<div class="alert alert-danger">שגיאה בפענוח התשובה מ-Gemini.</div>');
                }
                dialog.find('.btn-primary').removeClass('disabled');
            },
            onerror: function() {
                dialog.find('.bootbox-body').html('<div class="alert alert-danger">שגיאת תקשורת עם שרתי Google.</div>');
                dialog.find('.btn-primary').removeClass('disabled');
            }
        });
    }

    function cleanupOldButtons() {
        const oldFloatingBtn = document.getElementById('ai-summary-btn');
        if (oldFloatingBtn) oldFloatingBtn.remove();
    }

    function injectInlineButton() {
        const anchorElement = document.querySelector('[component="topic/sort"]') ||
                              document.querySelector('[component="topic/watch"]');

        if (!anchorElement) return;

        const targetContainer = document.querySelector('.sticky-tools .topic-main-buttons > div > div:first-child') ||
                                document.querySelector('.topic-main-buttons > div > div:first-child') ||
                                anchorElement.closest('ul') ||
                                anchorElement.closest('.btn-group') ||
                                anchorElement.parentNode;

        let btn = document.getElementById('native-ai-summary-btn');

        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'native-ai-summary-btn';

            // שימוש במחלקות המקוריות של הפורום לקבלת העיצוב המובנה (רקע אפור בריחוף)
            btn.className = 'btn btn-ghost btn-sm ff-secondary d-flex gap-2 align-items-center text-truncate';

            // הסרנו את ה-background: transparent כדי לתת למחלקת btn-ghost לעבוד!
            btn.style.cssText = 'order: 999; margin-right: 5px; cursor: pointer; display: inline-flex; border: none; outline: none;';

            btn.innerHTML = '<i class="fa fa-fw fa-magic text-primary"></i> <span class="fw-semibold text-truncate text-nowrap">סכם נושא</span>';

            btn.onclick = (e) => {
                e.preventDefault();
                startSummary();
            };

            targetContainer.appendChild(btn);
            cleanupOldButtons();
        } else {
            if (targetContainer.lastElementChild !== btn) {
                targetContainer.appendChild(btn);
            }
        }
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
