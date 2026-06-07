// ==UserScript==
// @name         Mitmachim & Otzaria Topic Summarizer - Universal Edition
// @namespace    https://github.com/
// @version      8.0
// @description  AI topic summarizer for both Mitmachim Top and Otzaria Forum (NodeBB based) with dynamic routing, UI Polish, Chat, and History.
// @match        https://mitmachim.top/*
// @match        https://otzaria.org/forum/*
// @match        https://bnebrak.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_setClipboard
// @connect      generativelanguage.googleapis.com
// ==/UserScript==

(function() {
    'use strict';

    const hostname = window.location.hostname;

const isMitmachim = hostname.includes('mitmachim.top');
const isOtzaria = hostname.includes('otzaria.org');
const isBneiBrak = hostname.includes('bnebrak.com');

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

    // עיצוב משלים לחלונית, בועות צ'אט, ניווט וצבעים דינמיים (Dark Mode Support) + סידור שורת כפתורים
    const customStyles = `
        @media (min-width: 768px) {
            .ai-summary-dialog .modal-dialog { width: 85% !important; max-width: 800px !important; }
        }
        .ai-chat-bubble-user { background: var(--bs-success-bg-subtle, #e7ffdb); color: var(--bs-body-color, #333); padding: 8px 14px; border-radius: 15px 15px 0 15px; display: inline-block; max-width: 85%; box-shadow: 0 1px 2px rgba(0,0,0,0.1); border: 1px solid var(--bs-border-color, transparent); }
        .ai-chat-bubble-ai { background: var(--bs-secondary-bg-subtle, #f1f3f4); color: var(--bs-body-color, #333); padding: 8px 14px; border-radius: 15px 15px 15px 0; display: inline-block; max-width: 90%; box-shadow: 0 1px 2px rgba(0,0,0,0.1); border: 1px solid var(--bs-border-color, transparent); }
        #nbe-ai-toast { position: fixed; bottom: 30px; left: 30px; z-index: 10500; background: var(--bs-primary, #0d6efd); color: var(--bs-primary-bg-subtle, #fff); padding: 12px 20px; border-radius: 50px; font-weight: bold; box-shadow: 0 4px 15px rgba(0,0,0,0.2); direction: rtl; display: flex; align-items: center; gap: 10px; transition: opacity 0.3s, transform 0.3s; transform: translateY(100px); opacity: 0; pointer-events: none; }
        #nbe-ai-toast.show { transform: translateY(0); opacity: 1; pointer-events: auto; }
        .ai-version-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .ai-chat-section { margin-top: 25px; border-top: 2px dashed var(--bs-border-color, #eee); padding-top: 15px; background: var(--bs-tertiary-bg, #fafafa); border-radius: 8px; padding: 15px; }
        #ai-version-nav { background: var(--bs-tertiary-bg, #f8f9fa); border: 1px solid var(--bs-border-color, #eee); }

        /* סידור חכם לשורת הכפתורים התחתונה למניעת בלאגן בעין */
        .ai-summary-dialog .modal-footer { display: flex; flex-wrap: wrap; justify-content: flex-start; gap: 8px; }
        .ai-summary-dialog .modal-footer > button { margin: 0 !important; }
        .ai-summary-dialog .modal-footer [data-bb-handler="ok"] { margin-right: auto !important; } /* דוחף את כפתור 'סגור' שמאלה */
    `;
    const styleSheet = document.createElement("style");
    styleSheet.innerText = customStyles;
    document.head.appendChild(styleSheet);

    // סטטוס מערכת
    let isFetching = false;
    window.nbeCurrentThreadText = null;
    window.nbeCurrentThreadTid = null;

    // ניהול מפתח API
    function getApiKey() {
        let key = GM_getValue('gemini_api_key_v2');
        if (!key) {
            key = prompt('אנא הכנס את מפתח ה-Gemini API שלך (הוא יישמר מקומית בדפדפן):');
            if (key) GM_setValue('gemini_api_key_v2', key);
        }
        return key;
    }

    // אבטחה (XSS)
    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, function(tag) {
            const charsToReplace = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
            return charsToReplace[tag] || tag;
        });
    }

    // המרת מארקדאון ל-HTML
    function formatSummaryText(text) {
        let html = escapeHTML(text);
        html = html.replace(/^### (.*?)$/gm, '<h4 style="margin-top:15px; margin-bottom:5px;"><strong>$1</strong></h4>');
        html = html.replace(/^## (.*?)$/gm, '<h3 style="margin-top:15px; margin-bottom:5px;"><strong>$1</strong></h3>');
        html = html.replace(/^# (.*?)$/gm, '<h2 style="margin-top:15px; margin-bottom:5px;"><strong>$1</strong></h2>');
        html = html.replace(/^[\*\-]\s+(.*)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>(?:\n<li>.*<\/li>)*)/g, '<ul style="padding-right: 25px; margin-bottom: 15px; margin-top: 5px;">$1</ul>');
        html = html.replace(/^\d+\.\s+(.*)$/gm, '<li class="ol-item">$1</li>');
        html = html.replace(/(<li class="ol-item">.*<\/li>(?:\n<li class="ol-item">.*<\/li>)*)/g, '<ol style="padding-right: 25px; margin-bottom: 15px; margin-top: 5px;">$1</ol>');
        html = html.replace(/class="ol-item"/g, '');
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
        html = html.replace(/`(.*?)`/g, '<code style="background:var(--bs-secondary-bg-subtle, #f1f3f4); padding:2px 5px; border-radius:4px; font-family:monospace; color:#d63384; font-size:90%;">$1</code>');
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="text-decoration:none; color:var(--bs-link-color, #0d6efd);">$1</a>');
        html = html.replace(/\n\n/g, '<br><br>');
        html = html.replace(/\n/g, '<br>');
        html = html.replace(/<br><ul/g, '<ul').replace(/<\/ul><br>/g, '</ul>');
        html = html.replace(/<br><ol/g, '<ol').replace(/<\/ol><br>/g, '</ol>');
        html = html.replace(/<\/li><br>/g, '</li>');
        return html;
    }

    // שולף את ה-TID מהכתובת
    function getTid() {
        const match = window.location.pathname.match(/\/topic\/(\d+)/);
        return match ? match[1] : null;
    }

    // מקבל את בסיס ה-API הנכון לפי הדומיין הנוכחי
    function getApiUrlBase() {
        return isOtzaria ? (window.location.origin + '/forum/api/topic/') : (window.location.origin + '/api/topic/');
    }

    // ==========================================
    // מנגנון Toast עדין (לא חוסם מסך)
    // ==========================================
    function showToast(msg) {
        let toast = document.getElementById('nbe-ai-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'nbe-ai-toast';
            document.body.appendChild(toast);
        }
        toast.innerHTML = `<i class="fa fa-spinner fa-spin"></i> <span>${msg}</span>`;
        setTimeout(() => toast.classList.add('show'), 10);
    }

    function hideToast() {
        let toast = document.getElementById('nbe-ai-toast');
        if (toast) toast.classList.remove('show');
    }

    // ==========================================
    // מנגנון היסטוריה גלובלית (רשימת אשכולות)
    // ==========================================
    function saveSummaryToHistory(tid, summaryText) {
        const titleEl = document.querySelector('span[component="topic/title"]') || document.querySelector('title');
        let title = titleEl ? titleEl.textContent.replace(' | מתמחים טופ', '').replace(' | פורום אוצר החכמה', '').replace(' | אוצרייתא', '').trim() : 'דיון ללא כותרת';

        let history = JSON.parse(GM_getValue('ai_summary_history_v1', '[]'));
        history = history.filter(h => h.tid !== tid);
        history.unshift({ tid, title, date: Date.now(), summary: summaryText });
        if (history.length > 20) history = history.slice(0, 20);

        GM_setValue('ai_summary_history_v1', JSON.stringify(history));
    }

    function openHistoryDialog() {
        const bootbox = window.bootbox || unsafeWindow.bootbox;
        const $ = window.$ || unsafeWindow.$;

        let history = JSON.parse(GM_getValue('ai_summary_history_v1', '[]'));
        if (history.length === 0) {
            bootbox.alert('אין עדיין היסטוריית סיכומים.');
            return;
        }

        let html = '<div class="list-group" style="direction: rtl; text-align: right; max-height: 400px; overflow-y: auto;">';
        history.forEach(h => {
            html += `<a href="#" class="list-group-item list-group-item-action nbe-history-item" data-tid="${h.tid}">
                <h5 class="mb-1" style="color: var(--bs-link-color, #0d6efd); font-weight: bold;">${escapeHTML(h.title)}</h5>
                <small class="text-muted"><i class="fa fa-clock-o"></i> ${new Date(h.date).toLocaleString('he-IL')}</small>
            </a>`;
        });
        html += '</div>';

        const historyDialog = bootbox.dialog({
            title: 'היסטוריית סיכומים גלובלית (20 אחרונים)',
            message: html,
            buttons: { close: { label: 'סגור', className: 'btn-default' } }
        });

        historyDialog.on('click', '.nbe-history-item', function(e) {
            e.preventDefault();
            const tid = $(this).data('tid');
            bootbox.hideAll();
            startSummaryCore(String(tid), getApiKey(), false);
        });
    }

    // ==========================================
    // משיכת הדיון מה-API
    // ==========================================
    async function fetchThreadText(tid) {
        let threadText = '';
        let fetchedPostsCount = 0;
        let totalPostsCount = 0;
        const apiBase = getApiUrlBase();

        try {
            const res = await fetch(apiBase + tid);
            const data = await res.json();

            totalPostsCount = data.postcount || 0;
            let allPosts = data.posts || [];
            const pageCount = data.pagination ? data.pagination.pageCount : 1;

            for (let p = 2; p <= pageCount; p++) {
                try {
                    const pageRes = await fetch(apiBase + `${tid}?page=${p}`);
                    const pageData = await pageRes.json();
                    if (pageData.posts) allPosts = allPosts.concat(pageData.posts);
                } catch (err) { console.error(err); }
            }

            allPosts.forEach((post, index) => {
                if (post && post.content && !post.deleted) {
                    fetchedPostsCount++;
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = post.content;
                    const text = tempDiv.innerText.trim();
                    if (text) threadText += `--- פוסט ${index + 1} ---\n${text}\n\n`;
                }
            });

            const MAX_CHARS = 80000;
            if (threadText.length > MAX_CHARS) {
                threadText = threadText.substring(0, MAX_CHARS) + "\n...[הטקסט נחתך עקב מגבלת אורך הדיון]...";
            }
        } catch (e) { console.error('API fetch error', e); }

        return { text: threadText, fetched: fetchedPostsCount, total: totalPostsCount };
    }

    // ==========================================
    // ניהול צ'אט (שאלות על הדיון)
    // ==========================================
    async function handleChatSubmit(tid, text, apiKey) {
        if (!apiKey) return;
        const input = document.getElementById('ai-chat-input');
        const submitBtn = document.getElementById('ai-chat-submit');
        const chatHistory = document.getElementById('ai-chat-history');

        input.value = '';
        input.disabled = true;
        submitBtn.disabled = true;

        chatHistory.innerHTML += `
            <div style="text-align: left; margin-bottom: 10px;">
                <span class="ai-chat-bubble-user">${escapeHTML(text)}</span>
            </div>`;
        chatHistory.scrollTop = chatHistory.scrollHeight;

        const loadingId = 'loading-' + Date.now();
        chatHistory.innerHTML += `
            <div id="${loadingId}" style="text-align: right; margin-bottom: 10px;">
                <span class="ai-chat-bubble-ai"><i class="fa fa-spinner fa-spin"></i> מעבד תגובה...</span>
            </div>`;
        chatHistory.scrollTop = chatHistory.scrollHeight;

        let threadText = window.nbeCurrentThreadText;
        if (!threadText || window.nbeCurrentThreadTid !== tid) {
            const fetched = await fetchThreadText(tid);
            threadText = fetched.text;
            window.nbeCurrentThreadText = threadText;
            window.nbeCurrentThreadTid = tid;
        }

        const promptText = `אתה עוזר וירטואלי (AI) חכם. עליך לענות על שאלת המשתמש בהתבסס **אך ורק** על תוכן הדיון הבא מתוך הפורום. אם התשובה לא נמצאת בדיון, אמור זאת ואל תמציא מידע. ענה בעברית, בצורה עניינית, קצרה ומועילה. תוכל להשתמש בעיצוב בסיסי של טקסט מודגש או רשימות.
שאלה: ${text}

דיון להסתמכות:
${threadText}`;

        GM_xmlhttpRequest({
            method: 'POST',
            url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`,
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }),
            onload: function(response) {
                document.getElementById(loadingId)?.remove();
                input.disabled = false;
                submitBtn.disabled = false;
                input.focus();

                try {
                    const res = JSON.parse(response.responseText);
                    if (res.error) {
                        chatHistory.innerHTML += `<div style="text-align: right; margin-bottom: 10px; color: var(--bs-danger, red);"><small>שגיאה: ${res.error.message}</small></div>`;
                    } else if (res.candidates && res.candidates.length > 0) {
                        const answer = res.candidates[0].content.parts[0].text;
                        const formattedAnswer = formatSummaryText(answer);
                        chatHistory.innerHTML += `
                            <div style="text-align: right; margin-bottom: 10px;">
                                <span class="ai-chat-bubble-ai">${formattedAnswer}</span>
                            </div>`;
                    }
                } catch (e) {
                     chatHistory.innerHTML += `<div style="text-align: right; margin-bottom: 10px; color: var(--bs-danger, red);"><small>שגיאה בפענוח תגובה.</small></div>`;
                }
                chatHistory.scrollTop = chatHistory.scrollHeight;
            },
            onerror: function() {
                document.getElementById(loadingId)?.remove();
                input.disabled = false;
                submitBtn.disabled = false;
                chatHistory.innerHTML += `<div style="text-align: right; margin-bottom: 10px; color: var(--bs-danger, red);"><small>שגיאת תקשורת עם שרתי Google.</small></div>`;
            }
        });
    }

    // ==========================================
    // הצגת חלונית הסיכום (החלון הראשי המקיף)
    // ==========================================
    function showSummaryDialog(tid, versions, currentIndex, isCached) {
        const bootbox = window.bootbox || unsafeWindow.bootbox;
        const $ = window.$ || unsafeWindow.$;
        const apiKey = getApiKey();
        const currentVer = versions[currentIndex];

        let titleHtml = 'סיכום הנושא';
        if (isCached) titleHtml += ' <span class="badge bg-secondary" style="font-size: 12px; margin-right: 5px;">מתוך הזיכרון</span>';

        // חיווי אורך הקריאה
        const fetchedCount = currentVer.fetched || '?';
        const totalCount = currentVer.total || '?';
        let indicatorHtml = `<div id="ai-read-indicator" style="font-size: 12px; color: var(--bs-secondary-color, #777); margin-top: 4px; margin-bottom: 10px;"><i class="fa fa-info-circle"></i> הסיכום מבוסס על קריאת ${fetchedCount} מתוך ${totalCount} התגובות בדיון.</div>`;

        // בניית סרגל גרסאות
        let navHtml = '';
        if (versions.length > 1) {
            navHtml = `
            <div id="ai-version-nav" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 15px; border-radius: 6px; margin-bottom: 10px;">
                <button id="ai-btn-prev-ver" class="btn btn-sm btn-default ai-version-btn" style="padding: 2px 8px;" ${currentIndex === 0 ? 'disabled' : ''}><i class="fa fa-chevron-right"></i> ישן</button>
                <div id="ai-ver-label" style="font-size: 13px; font-weight: 500; color: var(--bs-secondary-color, #555);">גרסה ${currentIndex + 1} מתוך ${versions.length} &nbsp;<span class="text-muted" style="font-size:11px;">(${new Date(currentVer.date).toLocaleString('he-IL')})</span></div>
                <button id="ai-btn-next-ver" class="btn btn-sm btn-default ai-version-btn" style="padding: 2px 8px;" ${currentIndex === versions.length - 1 ? 'disabled' : ''}>חדש <i class="fa fa-chevron-left"></i></button>
            </div>`;
        }

        const formattedHTML = formatSummaryText(currentVer.text);

        const dialogContent = `
            ${indicatorHtml}
            ${navHtml}
            <div style="font-size: 15px; line-height: 1.6; margin-bottom: 15px;" id="ai-summary-content">${formattedHTML}</div>

            <div class="ai-chat-section">
                <h5 style="font-size: 14px; color: var(--bs-secondary-color, #555); margin-bottom: 10px; font-weight: bold;"><i class="fa fa-comments-o"></i> שאלות על בסיס הדיון</h5>
                <div id="ai-chat-history" style="max-height: 200px; overflow-y: auto; margin-bottom: 10px; padding-right: 5px; font-size: 14px;"></div>
                <div style="display: flex; gap: 8px;">
                    <input type="text" id="ai-chat-input" class="form-control" placeholder="משהו לא ברור? שאל שאלה על הדיון..." style="flex: 1; font-size: 14px; border-radius: 20px; padding: 5px 15px; background: var(--bs-body-bg, #fff); color: var(--bs-body-color, #333);">
                    <button id="ai-chat-submit" class="btn btn-primary" style="border-radius: 50%; width: 38px; height: 38px; padding: 0; display: flex; align-items: center; justify-content: center;"><i class="fa fa-paper-plane" style="margin-right:-3px;"></i></button>
                </div>
            </div>
        `;

        const dialog = bootbox.dialog({
            title: titleHtml,
            message: dialogContent,
            closeButton: true,
            size: 'large',
            className: 'ai-summary-dialog',
            buttons: {
                publish: {
                    label: '<i class="fa fa-reply"></i> פרסם',
                    className: 'btn-success text-white',
                    callback: function() {
                        const textToPublish = dialog.data('rawSummary');
                        const replyBtn = document.querySelector('[component="topic/reply"]') || document.querySelector('.composer-reply, .btn-reply');
                        if (replyBtn) {
                            bootbox.hideAll();
                            replyBtn.click();

                            let attempts = 0;
                            const checkExist = setInterval(function() {
                                const textarea = document.querySelector('.composer textarea, [component="composer/body"]');
                                if (textarea) {
                                    clearInterval(checkExist);
                                    textarea.value = textToPublish + '\n\n> _סוכם באמצעות AI 🤖_';
                                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                                    textarea.focus();
                                }
                                if (++attempts > 30) clearInterval(checkExist);
                            }, 100);
                        } else {
                            bootbox.alert('לא נמצא כפתור תגובה (אולי האשכול נעול?).');
                        }
                        return false;
                    }
                },
                copy: {
                    label: '<i class="fa fa-clone"></i> העתק',
                    className: 'btn-default nbe-copy-btn',
                    callback: function() {
                        const textToCopy = dialog.data('rawSummary');
                        GM_setClipboard(textToCopy);
                        const btn = dialog.find('.nbe-copy-btn');
                        btn.html('<i class="fa fa-check"></i> הועתק').removeClass('btn-default').addClass('btn-success text-white');
                        setTimeout(() => btn.html('<i class="fa fa-clone"></i> העתק').removeClass('btn-success text-white').addClass('btn-default'), 2000);
                        return false;
                    }
                },
                history: {
                    label: '<i class="fa fa-history"></i> היסטוריה',
                    className: 'btn-default',
                    callback: function() { openHistoryDialog(); return true; }
                },
                editPrompt: {
                    label: '<i class="fa fa-sliders"></i> הנחיה',
                    className: 'btn-default',
                    callback: function() { showPromptEditor(tid); return true; }
                },
                refresh: {
                    label: '<i class="fa fa-refresh"></i> רענן',
                    className: 'btn-default',
                    callback: function() { startSummaryCore(tid, apiKey, true); }
                },
                ok: { label: 'סגור', className: 'btn-primary' }
            }
        });

        // שמירת המידע הגולמי
        dialog.data('rawSummary', currentVer.text);

        setTimeout(() => {
            let activeIdx = currentIndex;

            // עדכון דינמי של מסך הגרסאות
            if (versions.length > 1) {
                const updateView = () => {
                    const v = versions[activeIdx];
                    dialog.find('#ai-summary-content').html(formatSummaryText(v.text));
                    dialog.find('#ai-ver-label').html(`גרסה ${activeIdx + 1} מתוך ${versions.length} &nbsp;<span class="text-muted" style="font-size:11px;">(${new Date(v.date).toLocaleString('he-IL')})</span>`);
                    dialog.find('#ai-read-indicator').html(`<i class="fa fa-info-circle"></i> הסיכום מבוסס על קריאת ${v.fetched || '?'} מתוך ${v.total || '?'} התגובות בדיון.`);
                    dialog.find('#ai-btn-prev-ver').prop('disabled', activeIdx === 0);
                    dialog.find('#ai-btn-next-ver').prop('disabled', activeIdx === versions.length - 1);
                    dialog.data('rawSummary', v.text);
                };

                dialog.find('#ai-btn-prev-ver').on('click', function(e) {
                    e.preventDefault();
                    if (activeIdx > 0) { activeIdx--; updateView(); }
                });

                dialog.find('#ai-btn-next-ver').on('click', function(e) {
                    e.preventDefault();
                    if (activeIdx < versions.length - 1) { activeIdx++; updateView(); }
                });
            }

            // הפעלת מנגנון צ'אט
            const submitBtn = document.getElementById('ai-chat-submit');
            const inputField = document.getElementById('ai-chat-input');
            if (submitBtn && inputField) {
                const handleSend = () => {
                    const text = inputField.value.trim();
                    if(text) handleChatSubmit(tid, text, apiKey);
                };
                submitBtn.onclick = handleSend;
                inputField.onkeypress = (e) => { if (e.key === 'Enter') handleSend(); };
            }
        }, 300);
    }

    // ==========================================
    // עריכת הנחיה (Prompt Editor)
    // ==========================================
    function showPromptEditor(tid) {
        const bootbox = window.bootbox || unsafeWindow.bootbox;
        const currentPrompt = GM_getValue('custom_ai_prompt_v1') || defaultPromptText;

        bootbox.dialog({
            title: 'הגדרות מתקדמות: התאמת הנחיה (Prompt)',
            message: `
                <div style="direction: rtl; text-align: right;">
                    <p style="margin-bottom: 15px; color: var(--bs-secondary-color, #555); font-size: 14px;">
                        כאן תוכל לערוך את ההוראות שנשלחות לבינה המלאכותית לפני הסיכום.<br>
                        <strong>טיפ:</strong> אם תמחק את כל הטקסט ותשמור, המערכת תחזור אוטומטית להנחיית ברירת המחדל.
                    </p>
                    <textarea id="custom-prompt-textarea" class="form-control" rows="15" style="width: 100%; resize: vertical; font-family: monospace; direction: rtl; font-size: 13px; line-height: 1.5; background: var(--bs-body-bg, #fff); color: var(--bs-body-color, #333);">${escapeHTML(currentPrompt)}</textarea>
                </div>
            `,
            size: 'large',
            buttons: {
                save: {
                    label: '<i class="fa fa-save"></i> שמור וסכם מחדש',
                    className: 'btn-primary',
                    callback: function() {
                        const newPrompt = document.getElementById('custom-prompt-textarea').value.trim();
                        if (newPrompt) GM_setValue('custom_ai_prompt_v1', newPrompt);
                        else GM_setValue('custom_ai_prompt_v1', '');
                        startSummaryCore(tid, getApiKey(), true);
                    }
                },
                cancel: { label: 'ביטול', className: 'btn-default' }
            }
        });
    }

    // ==========================================
    // תהליך הפקת סיכום מרכזי (ללא עצירת ממשק)
    // ==========================================
    async function startSummaryCore(tid, apiKey, forceNew = false) {
        if (isFetching) return;

        const bootbox = window.bootbox || unsafeWindow.bootbox;
        const cacheKey = `ai_summary_versions_tid_${tid}_v4`;

        let versions = [];
        try { versions = JSON.parse(localStorage.getItem(cacheKey) || '[]'); }
        catch (e) { versions = []; }

        if (!forceNew && versions.length > 0) {
            showSummaryDialog(tid, versions, versions.length - 1, true);
            return;
        }

        isFetching = true;
        showToast('ה-AI קורא ומסכם את הדיון...');

        const fetchedData = await fetchThreadText(tid);
        window.nbeCurrentThreadText = fetchedData.text;
        window.nbeCurrentThreadTid = tid;

        if (!fetchedData.text) {
            hideToast();
            isFetching = false;
            bootbox.alert('שגיאה: לא הצלחתי לקרוא את תוכן הדיון.');
            return;
        }

        const customPrompt = GM_getValue('custom_ai_prompt_v1') || defaultPromptText;
        const finalPrompt = `${customPrompt}\n\nהנה הפוסטים לסיכום:\n\n${fetchedData.text}`;

        GM_xmlhttpRequest({
            method: 'POST',
            url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`,
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify({ contents: [{ parts: [{ text: finalPrompt }] }] }),
            onload: function(response) {
                isFetching = false;
                hideToast();
                try {
                    const res = JSON.parse(response.responseText);
                    if (res.error) {
                        if (res.error.code === 400 && res.error?.message?.includes("API key not valid")) {
                            bootbox.alert('מפתח ה-API לא תקין. הוא אופס. רענן את העמוד ונסה שוב.');
                            GM_setValue('gemini_api_key_v2', '');
                        } else {
                            bootbox.alert(`שגיאה: ${res.error.message}`);
                        }
                    } else if (res.candidates && res.candidates.length > 0) {
                        const summary = res.candidates[0].content.parts[0].text;

                        // שמירת גרסה חדשה עם נתוני שקיפות קריאה
                        versions.push({
                            text: summary,
                            date: Date.now(),
                            fetched: fetchedData.fetched,
                            total: fetchedData.total
                        });
                        if (versions.length > 5) versions.shift();
                        localStorage.setItem(cacheKey, JSON.stringify(versions));

                        saveSummaryToHistory(tid, summary);
                        showSummaryDialog(tid, versions, versions.length - 1, false);
                    } else {
                        bootbox.alert('התקבלה תשובה ריקה מהשרת.');
                    }
                } catch (e) {
                    bootbox.alert('שגיאה בפענוח התשובה מ-Gemini.');
                }
            },
            onerror: function() {
                isFetching = false;
                hideToast();
                bootbox.alert('שגיאת תקשורת עם שרתי Google.');
            }
        });
    }

    // ==========================================
    // הזרקת כפתורים (עליון חכם ותחתון בהשגחה)
    // ==========================================
    function injectInlineButton() {
        const toolbars = document.querySelectorAll('.topic-main-buttons > div > div:first-child, .topic .action-bar .d-flex');

        toolbars.forEach((toolbar, index) => {
            const isTop = index === 0;
            const btnId = isTop ? 'native-ai-summary-btn-top' : 'native-ai-summary-btn-bottom';
            let btn = document.getElementById(btnId);

            if (!btn) {
                btn = document.createElement('button');
                btn.id = btnId;
                btn.className = 'btn btn-ghost btn-sm ff-secondary d-flex gap-2 align-items-center text-truncate';

                // הכפתור העליון תמיד מנסה להיות מוצג, התחתון מסתתר כברירת מחדל עד שיקבל הוראה אחרת מה-Observer
                const displayStyle = isTop ? 'inline-flex' : 'none';
                btn.style.cssText = `order: 999; margin-right: 5px; cursor: pointer; display: ${displayStyle}; border: none; outline: none;`;

                btn.innerHTML = '<i class="fa fa-fw fa-magic text-primary"></i> <span class="d-none d-md-inline fw-semibold text-truncate text-nowrap">סכם נושא</span>';

                btn.onclick = (e) => {
                    e.preventDefault();
                    const tid = getTid();
                    if(tid) {
                        const apiKey = getApiKey();
                        if(apiKey) startSummaryCore(tid, apiKey, false);
                    }
                };

                toolbar.appendChild(btn);

                // הפעלת "השגחה חכמה" על הכפתור העליון בלבד
                if (isTop && !window.nbeAiBtnObserver) {
                    window.nbeAiBtnObserver = new IntersectionObserver((entries) => {
                        const topVisible = entries[0].isIntersecting;
                        const bBtn = document.getElementById('native-ai-summary-btn-bottom');
                        if (bBtn) bBtn.style.display = topVisible ? 'none' : 'inline-flex';
                    });
                    window.nbeAiBtnObserver.observe(toolbar);
                }

            } else if (toolbar.lastElementChild !== btn) {
                // אכיפת המיקום האחרון תמיד בשורה!
                toolbar.appendChild(btn);
            }
        });

        // מחיקת כפתורים ישנים מגרסאות עבר
        const oldFloatingBtn = document.getElementById('ai-summary-btn');
        const oldNativeBtn = document.getElementById('native-ai-summary-btn');
        if (oldFloatingBtn) oldFloatingBtn.remove();
        if (oldNativeBtn) oldNativeBtn.remove();
    }

    let _observerBusy = false;
    const globalObserver = new MutationObserver(() => {
        if (_observerBusy) return;
        _observerBusy = true;
        try { injectInlineButton(); } finally { _observerBusy = false; }
    });

    globalObserver.observe(document.body, { childList: true, subtree: true });
    injectInlineButton();

})();
