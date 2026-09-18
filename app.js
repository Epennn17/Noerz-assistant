/* =========================================================
   NOERZ ASSISTANT — app.js
   Chat + multiple sessions + like/star + Supabase + logo
   ========================================================= */

(function () {
  'use strict';

  /* ============ CONFIG ============ */
  const PROXY_URL = '/api/proxy';
  const API_TARGET = 'https://api.alwayscodex.eu.cc/api/ai/voidchat';
  const LOGO_URL = 'assets/logo.png';
  const TIMEOUT = 60000;
  const MODEL_KEY = 'noerz_assistant_model_v1';
  const MAX_CHATS = 50;

  /* ============ MODELS ============ */
  const MODELS = [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', desc: 'Cepat & efisien' },
    { id: 'gpt-4o', name: 'GPT-4o', desc: 'Pintar & seimbang' },
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', desc: 'Bagus untuk coding' },
    { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet', desc: 'Terbaru Claude' },
    { id: 'gemini-2-0-flash', name: 'Gemini 2.0 Flash', desc: 'Cepat dari Google' },
    { id: 'deepseek/deepseek-chat-v3-0324', name: 'DeepSeek Chat V3', desc: 'Chat umum, terbaru' },
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', desc: 'Chat umum' },
    { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', desc: 'Reasoning & logika' },
    { id: 'qwen/qwen-2-5-72b', name: 'Qwen 2.5 72B', desc: 'Model besar, pintar' }
  ];

  /* ============ STATE ============ */
  let currentModel = localStorage.getItem(MODEL_KEY) || 'gpt-4o-mini';
  let userId = null;
  let chats = [];
  let activeChatId = null;
  let isSending = false;
  let isAnimatingModel = false;

  /* ============ DOM ============ */
  const chatArea = document.getElementById('chatArea');
  const chatContainer = document.getElementById('chatContainer');
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const newChatBtn = document.getElementById('newChatBtn');
  const historyBtn = document.getElementById('historyBtn');
  const historyModal = document.getElementById('historyModal');
  const historyModalClose = document.getElementById('historyModalClose');
  const historyList = document.getElementById('historyList');
  const modelBtn = document.getElementById('modelBtn');
  const currentModelEl = document.getElementById('currentModel');
  const modelModal = document.getElementById('modelModal');
  const modelModalClose = document.getElementById('modelModalClose');
  const modelList = document.getElementById('modelList');
  const modelChangeOverlay = document.getElementById('modelChangeOverlay');
  const modelChangeName = document.getElementById('modelChangeName');

  /* ============ INIT ============ */
  document.addEventListener('DOMContentLoaded', async function () {
    if (document.body.dataset.page !== 'chat') return;

    await new Promise(function (r) { setTimeout(r, 300); });

    const sb = window.getSupabase();
    if (!sb) {
      window.showToast('Supabase tidak tersedia.', 'error');
      return;
    }

    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    userId = user.id;

    renderModelList();
    updateCurrentModelLabel();
    setupEvents();
    autoResizeTextarea();

    chatContainer.innerHTML =
      '<div class="loading-state">' +
        "<i class='bx bx-loader-alt'></i>" +
        'Memuat riwayat chat...' +
      '</div>';

    await loadChats();

    if (chats.length > 0) {
      const sorted = chats.slice().sort(function (a, b) {
        return new Date(b.updated_at) - new Date(a.updated_at);
      });
      activeChatId = sorted[0].id;
      renderChat();
      scrollToBottom();
    } else {
      createNewChat();
    }
  });

  /* ============ SETUP EVENTS ============ */
  function setupEvents() {
    messageInput.addEventListener('input', function () {
      sendBtn.disabled = messageInput.value.trim().length === 0 || isSending;
      autoResizeTextarea();
    });

    messageInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn.disabled) sendMessage();
      }
    });

    sendBtn.addEventListener('click', sendMessage);

    if (newChatBtn) newChatBtn.addEventListener('click', createNewChat);

    if (historyBtn) {
      historyBtn.addEventListener('click', function () {
        renderHistoryList();
        historyModal.classList.add('show');
      });
    }

    if (historyModalClose) {
      historyModalClose.addEventListener('click', function () {
        historyModal.classList.remove('show');
      });
    }

    if (historyModal) {
      historyModal.addEventListener('click', function (e) {
        if (e.target === historyModal) historyModal.classList.remove('show');
      });
    }

    modelBtn.addEventListener('click', function () {
      if (isAnimatingModel) return;
      modelModal.classList.add('show');
    });

    modelModalClose.addEventListener('click', function () {
      modelModal.classList.remove('show');
    });

    modelModal.addEventListener('click', function (e) {
      if (e.target === modelModal) modelModal.classList.remove('show');
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        modelModal.classList.remove('show');
        if (historyModal) historyModal.classList.remove('show');
      }
    });
  }

  /* ============ AUTO RESIZE ============ */
  function autoResizeTextarea() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 140) + 'px';
  }

  /* ============ MODEL ============ */
  function getModel(id) {
    return MODELS.find(function (m) { return m.id === id; }) || MODELS[0];
  }

  function updateCurrentModelLabel() {
    const model = getModel(currentModel);
    if (currentModelEl) currentModelEl.textContent = model.name;
  }

  function renderModelList() {
    if (!modelList) return;
    modelList.innerHTML = '';

    MODELS.forEach(function (model) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'model-option' + (model.id === currentModel ? ' active' : '');

      btn.innerHTML =
        '<div class="model-option-icon">' +
          '<img src="' + LOGO_URL + '" alt="' + escapeHtml(model.name) + '">' +
        '</div>' +
        '<div class="model-option-info">' +
          '<strong>' + escapeHtml(model.name) + '</strong>' +
          '<span>' + escapeHtml(model.desc) + '</span>' +
        '</div>' +
        '<i class="bx bx-check model-option-check"></i>';

      btn.addEventListener('click', function () {
        selectModel(model.id);
      });

      modelList.appendChild(btn);
    });
  }

  function selectModel(modelId) {
    if (modelId === currentModel) {
      modelModal.classList.remove('show');
      return;
    }

    const model = getModel(modelId);
    currentModel = modelId;
    localStorage.setItem(MODEL_KEY, currentModel);

    modelModal.classList.remove('show');
    showModelChangeAnimation(model);

    setTimeout(function () {
      updateCurrentModelLabel();
      renderModelList();
    }, 400);
  }

  function showModelChangeAnimation(model) {
    if (!modelChangeOverlay) {
      window.showToast('Model: ' + model.name, 'info');
      return;
    }
    isAnimatingModel = true;
    if (modelChangeName) modelChangeName.textContent = model.name;
    modelChangeOverlay.classList.add('show');
    setTimeout(function () {
      modelChangeOverlay.classList.remove('show');
      isAnimatingModel = false;
    }, 1400);
  }

  /* ============ SUPABASE STORAGE ============ */
  async function loadChats() {
    const sb = window.getSupabase();
    if (!sb) return;
    try {
      const { data, error } = await sb
        .from('chats')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(MAX_CHATS);
      if (error || !data) {
        chats = [];
        return;
      }
      chats = data.map(function (row) {
        return {
          id: row.id,
          title: row.title,
          messages: row.messages || [],
          created_at: row.created_at,
          updated_at: row.updated_at
        };
      });
    } catch (err) { chats = []; }
  }

  async function saveChat(chat) {
    const sb = window.getSupabase();
    if (!sb) return;
    try {
      await sb.from('chats').upsert({
        id: chat.id,
        user_id: userId,
        title: chat.title,
        messages: chat.messages,
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn('[saveChat] gagal', err);
    }
  }

  async function deleteChatDb(chatId) {
    const sb = window.getSupabase();
    if (!sb) return;
    try {
      await sb.from('chats').delete().eq('id', chatId).eq('user_id', userId);
    } catch (err) {
      console.warn('[deleteChat] gagal', err);
    }
  }

  /* ============ CHAT MANAGEMENT ============ */
  function createNewChat() {
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'chat_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    const chat = {
      id: id,
      title: 'Chat Baru',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      messages: []
    };

    chats.unshift(chat);
    activeChatId = id;

    if (chats.length > MAX_CHATS) {
      const removed = chats.pop();
      if (removed) deleteChatDb(removed.id);
    }

    renderChat();
    renderEmptyState();
    saveChat(chat);
    messageInput.focus();
    if (historyModal) historyModal.classList.remove('show');
  }

  function getActiveChat() {
    return chats.find(function (c) { return c.id === activeChatId; });
  }

  /* ============ HISTORY LIST ============ */
  function renderHistoryList() {
    if (!historyList) return;
    historyList.innerHTML = '';

    if (chats.length === 0) {
      historyList.innerHTML =
        '<div class="history-empty">' +
          "<i class='bx bx-message-square'></i>" +
          '<p>Belum ada riwayat chat</p>' +
        '</div>';
      return;
    }

    const sorted = chats.slice().sort(function (a, b) {
      return new Date(b.updated_at) - new Date(a.updated_at);
    });

    sorted.forEach(function (chat) {
      const item = document.createElement('div');
      item.className = 'history-item' + (chat.id === activeChatId ? ' active' : '');
      const msgCount = (chat.messages || []).length;

      item.innerHTML =
        '<div class="history-item-icon"><i class="bx bx-message-square"></i></div>' +
        '<div class="history-item-info">' +
          '<strong>' + escapeHtml(chat.title || 'Chat Baru') + '</strong>' +
          '<span>' + formatDate(chat.updated_at) + ' · ' + msgCount + ' pesan</span>' +
        '</div>' +
        '<button type="button" class="history-item-del" data-del="' + chat.id + '" aria-label="Hapus">' +
          "<i class='bx bx-trash'></i>" +
        '</button>';

      item.addEventListener('click', function (e) {
        if (e.target.closest('[data-del]')) return;
        selectChat(chat.id);
      });

      const delBtn = item.querySelector('[data-del]');
      delBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        deleteChat(chat.id);
      });

      historyList.appendChild(item);
    });

    if (chats.length > 1) {
      const wrap = document.createElement('div');
      wrap.style.padding = '8px 8px 12px';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'history-del-all';
      btn.innerHTML = "<i class='bx bx-trash'></i> Hapus Semua Riwayat";
      btn.addEventListener('click', deleteAllChats);
      wrap.appendChild(btn);
      historyList.appendChild(wrap);
    }
  }

  function selectChat(chatId) {
    activeChatId = chatId;
    if (historyModal) historyModal.classList.remove('show');
    renderChat();
    scrollToBottom();
  }

  function deleteChat(chatId) {
    if (!confirm('Hapus chat ini?')) return;

    chats = chats.filter(function (c) { return c.id !== chatId; });
    deleteChatDb(chatId);

    if (activeChatId === chatId) {
      if (chats.length > 0) {
        activeChatId = chats[0].id;
      } else {
        createNewChat();
        if (historyList) renderHistoryList();
        return;
      }
    }

    renderHistoryList();
    renderChat();
    window.showToast('Chat dihapus.', 'success');
  }

  function deleteAllChats() {
    if (!confirm('Hapus SEMUA riwayat chat?')) return;
    const ids = chats.map(function (c) { return c.id; });
    chats = [];
    activeChatId = null;
    ids.forEach(function (id) { deleteChatDb(id); });
    createNewChat();
    if (historyModal) historyModal.classList.remove('show');
    window.showToast('Semua riwayat dihapus.', 'success');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return 'Baru saja';
    if (diff < 3600) return Math.floor(diff / 60) + ' menit lalu';
    if (diff < 86400) return Math.floor(diff / 3600) + ' jam lalu';
    if (diff < 604800) return Math.floor(diff / 86400) + ' hari lalu';
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  }

  /* ============ EMPTY STATE ============ */
  function renderEmptyState() {
    chatContainer.innerHTML =
      '<div class="empty">' +
        '<img src="' + LOGO_URL + '" alt="Noerz Assistant">' +
        '<h2>Noerz Assistant</h2>' +
        '<p>Tanya apa saja. Gratis.</p>' +
        '<div class="suggestions">' +
          '<button type="button" class="suggestion" data-prompt="Jelaskan tentang AI dalam bahasa sederhana">Jelaskan tentang AI dalam bahasa sederhana</button>' +
          '<button type="button" class="suggestion" data-prompt="Buat puisi pendek tentang hujan">Buat puisi pendek tentang hujan</button>' +
          '<button type="button" class="suggestion" data-prompt="Apa tips produktif bekerja dari rumah?">Tips produktif bekerja dari rumah</button>' +
          '<button type="button" class="suggestion" data-prompt="Tolong bantu saya menulis caption Instagram">Bantu tulis caption Instagram</button>' +
        '</div>' +
      '</div>';

    chatContainer.querySelectorAll('.suggestion').forEach(function (btn) {
      btn.addEventListener('click', function () {
        messageInput.value = btn.getAttribute('data-prompt');
        sendBtn.disabled = false;
        autoResizeTextarea();
        sendMessage();
      });
    });
  }

  /* ============ RENDER CHAT ============ */
  function renderChat() {
    const chat = getActiveChat();
    if (!chat || chat.messages.length === 0) {
      renderEmptyState();
      return;
    }
    chatContainer.innerHTML = '';
    chat.messages.forEach(function (msg, index) {
      chatContainer.appendChild(createMessageEl(msg, chat.id, index));
    });
  }

  function createMessageEl(msg, chatId, index) {
    const div = document.createElement('div');
    div.className = 'msg ' + (msg.role === 'user' ? 'user' : 'ai');

    const avatarHtml = msg.role === 'user'
      ? '<div class="msg-avatar">U</div>'
      : '<div class="msg-avatar"><img src="' + LOGO_URL + '" alt="AI"></div>';

    let actionsHtml = '';
    if (msg.role === 'ai') {
      actionsHtml =
        '<div class="msg-actions">' +
          '<button type="button" class="msg-action-btn" data-action="copy"><i class="bx bx-copy"></i> Copy</button>' +
          '<button type="button" class="msg-action-btn' + (msg.liked === 'good' ? ' active good' : '') + '" data-action="like"><i class="bx bx-like"></i></button>' +
          '<button type="button" class="msg-action-btn' + (msg.liked === 'bad' ? ' active bad' : '') + '" data-action="dislike"><i class="bx bx-dislike"></i></button>' +
          '<button type="button" class="msg-action-btn' + (msg.starred ? ' active star' : '') + '" data-action="star"><i class="bx ' + (msg.starred ? 'bxs-star' : 'bx-star') + '"></i></button>' +
        '</div>';
    }

    div.innerHTML = avatarHtml +
      '<div class="msg-body">' +
        '<div class="msg-bubble">' + formatMessage(msg.content) + '</div>' +
        actionsHtml +
      '</div>';

    if (msg.role === 'ai') {
      const copyBtn = div.querySelector('[data-action="copy"]');
      const likeBtn = div.querySelector('[data-action="like"]');
      const dislikeBtn = div.querySelector('[data-action="dislike"]');
      const starBtn = div.querySelector('[data-action="star"]');

      if (copyBtn) {
        copyBtn.addEventListener('click', function () {
          window.copyToClipboard(msg.content).then(function (ok) {
            if (ok) {
              copyBtn.classList.add('copied');
              copyBtn.innerHTML = "<i class='bx bx-check'></i> Tersalin";
              setTimeout(function () {
                copyBtn.classList.remove('copied');
                copyBtn.innerHTML = "<i class='bx bx-copy'></i> Copy";
              }, 2000);
            }
          });
        });
      }
      if (likeBtn) {
        likeBtn.addEventListener('click', function () {
          const chat = getActiveChat();
          if (!chat) return;
          chat.messages[index].liked = (chat.messages[index].liked === 'good') ? null : 'good';
          saveChat(chat);
          renderChat();
        });
      }
      if (dislikeBtn) {
        dislikeBtn.addEventListener('click', function () {
          const chat = getActiveChat();
          if (!chat) return;
          chat.messages[index].liked = (chat.messages[index].liked === 'bad') ? null : 'bad';
          saveChat(chat);
          renderChat();
        });
      }
      if (starBtn) {
        starBtn.addEventListener('click', function () {
          const chat = getActiveChat();
          if (!chat) return;
          chat.messages[index].starred = !chat.messages[index].starred;
          saveChat(chat);
          renderChat();
          if (chat.messages[index].starred) {
            window.showToast('Ditambahkan ke favorit.', 'success');
          }
        });
      }
    }
    return div;
  }

  function formatMessage(text) {
    if (!text) return '';
    let html = escapeHtml(text);
    html = html.replace(/```([\s\S]*?)```/g, function (m, code) {
      return '<pre><code>' + code.trim() + '</code></pre>';
    });
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  /* ============ SEND MESSAGE ============ */
  async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || isSending) return;

    const chat = getActiveChat();
    if (!chat) { createNewChat(); return; }

    isSending = true;
    sendBtn.disabled = true;

    if (chat.messages.length === 0) chatContainer.innerHTML = '';

    const userMsg = { role: 'user', content: text, time: Date.now() };
    chat.messages.push(userMsg);
    chatContainer.appendChild(createMessageEl(userMsg, chat.id, chat.messages.length - 1));

    if (chat.title === 'Chat Baru') {
      chat.title = text.slice(0, 40) + (text.length > 40 ? '...' : '');
    }
    chat.updated_at = new Date().toISOString();
    saveChat(chat);

    messageInput.value = '';
    autoResizeTextarea();
    scrollToBottom();

    const typingEl = document.createElement('div');
    typingEl.className = 'msg ai';
    typingEl.id = 'typingIndicator';
    typingEl.innerHTML =
      '<div class="msg-avatar"><img src="' + LOGO_URL + '" alt="AI"></div>' +
      '<div class="msg-body"><div class="msg-bubble"><div class="typing">' +
        '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>' +
      '</div></div></div>';
    chatContainer.appendChild(typingEl);
    scrollToBottom();

    try {
      const reply = await callAI(text);
      const t = document.getElementById('typingIndicator');
      if (t) t.remove();

      const aiMsg = { role: 'ai', content: reply, time: Date.now() };
      chat.messages.push(aiMsg);
      chatContainer.appendChild(createMessageEl(aiMsg, chat.id, chat.messages.length - 1));
      chat.updated_at = new Date().toISOString();
      saveChat(chat);
      scrollToBottom();

    } catch (err) {
      const t = document.getElementById('typingIndicator');
      if (t) t.remove();
      const errMsg = err.message === 'TIMEOUT'
        ? 'Request timeout. Coba lagi.'
        : (err.message || 'Gagal menghubungi server AI.');
      window.showToast(errMsg, 'error');
      const aiMsg = { role: 'ai', content: '*Maaf, terjadi kesalahan: ' + errMsg + '*', time: Date.now() };
      chat.messages.push(aiMsg);
      chatContainer.appendChild(createMessageEl(aiMsg, chat.id, chat.messages.length - 1));
      saveChat(chat);
      scrollToBottom();
    } finally {
      isSending = false;
      sendBtn.disabled = messageInput.value.trim().length === 0;
    }
  }

  /* ============ CALL AI ============ */
  async function callAI(text) {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, TIMEOUT);

    try {
      const res = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: API_TARGET, text: text, model: currentModel }),
        signal: controller.signal
      });
      clearTimeout(timer);

      let data = null;
      try {
        const txt = await res.text();
        if (txt && txt.trim()) data = JSON.parse(txt);
      } catch (e) { data = null; }

      if (!res.ok) {
        const msg = (data && (data.error || data.message)) || 'Server error (' + res.status + ').';
        throw new Error(msg);
      }
      if (!data || data.status !== true || !data.result) {
        const msg = (data && (data.error || data.message)) || 'Response tidak valid.';
        throw new Error(msg);
      }
      return String(data.result).trim();
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') throw new Error('TIMEOUT');
      if (err.message && err.message.indexOf('fetch') !== -1) throw new Error('Gagal terhubung ke server.');
      throw err;
    }
  }

  /* ============ UTILS ============ */
  function scrollToBottom() {
    requestAnimationFrame(function () {
      chatArea.scrollTop = chatArea.scrollHeight;
    });
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  if (!window.copyToClipboard) {
    window.copyToClipboard = async function (text) {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          return true;
        }
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch (err) { return false; }
    };
  }

})();