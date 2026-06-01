(function () {
  const loginShell = document.getElementById('admin-login');
  const dashboardShell = document.getElementById('admin-dashboard');
  const loginForm = document.getElementById('login-form');
  const loginEmail = document.getElementById('login-email');
  const loginStatus = document.getElementById('login-status');
  const accountEl = document.getElementById('admin-account');
  const logoutBtn = document.getElementById('logout-btn');
  const pendingListEl = document.getElementById('pending-list');
  const approvedListEl = document.getElementById('approved-list');
  const actionStatus = document.getElementById('action-status');

  function isConfigured() {
    return typeof SUPABASE_URL === 'string'
      && typeof SUPABASE_ANON_KEY === 'string'
      && !SUPABASE_URL.startsWith('REPLACE')
      && !SUPABASE_ANON_KEY.startsWith('REPLACE');
  }

  if (!isConfigured()) {
    setLoginStatus("Configurez d'abord SUPABASE_URL et SUPABASE_ANON_KEY dans js/config.js.", 'is-error');
    return;
  }
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    setLoginStatus("SDK Supabase non chargé.", 'is-error');
    return;
  }

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  function setLoginStatus(msg, type = '') {
    if (!loginStatus) return;
    loginStatus.textContent = msg;
    loginStatus.classList.remove('is-error', 'is-success');
    if (type) loginStatus.classList.add(type);
  }

  function setActionStatus(msg, type = '') {
    if (!actionStatus) return;
    actionStatus.textContent = msg;
    actionStatus.classList.remove('is-error', 'is-success');
    if (type) actionStatus.classList.add(type);
    if (msg) setTimeout(() => { if (actionStatus.textContent === msg) setActionStatus(''); }, 3500);
  }

  function showLogin() {
    loginShell.style.display = '';
    dashboardShell.style.display = 'none';
  }

  function showDashboard(session) {
    loginShell.style.display = 'none';
    dashboardShell.style.display = '';
    if (accountEl) accountEl.textContent = session.user.email || '';
    refreshLists();
    refreshPosts();
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function renderRow(comment, isPending) {
    const row = document.createElement('div');
    row.className = 'admin-row';
    row.dataset.id = comment.id;

    const head = document.createElement('div');
    head.className = 'admin-row-head';
    const name = document.createElement('span');
    name.className = 'admin-row-name';
    name.textContent = comment.author_name || '';
    const slug = document.createElement('span');
    slug.className = 'admin-row-slug';
    slug.textContent = comment.post_slug || '';
    head.appendChild(name);
    head.appendChild(slug);
    if (comment.parent_id) {
      const parent = document.createElement('span');
      parent.className = 'admin-row-parent';
      parent.textContent = '↳ réponse';
      head.appendChild(parent);
    }
    if (comment.is_admin) {
      const badge = document.createElement('span');
      badge.className = 'admin-row-parent';
      badge.textContent = '(auteur)';
      head.appendChild(badge);
    }
    const date = document.createElement('span');
    date.className = 'admin-row-date';
    date.textContent = formatDate(comment.created_at);
    head.appendChild(date);

    const body = document.createElement('div');
    body.className = 'admin-row-body';
    body.textContent = comment.body || '';

    const actions = document.createElement('div');
    actions.className = 'admin-row-actions';

    if (isPending) {
      const approveBtn = document.createElement('button');
      approveBtn.type = 'button';
      approveBtn.className = 'admin-btn';
      approveBtn.textContent = 'Approuver';
      approveBtn.addEventListener('click', () => approveComment(comment.id));
      actions.appendChild(approveBtn);
    }

    const replyBtn = document.createElement('button');
    replyBtn.type = 'button';
    replyBtn.className = 'admin-btn ghost';
    replyBtn.textContent = 'Répondre';
    actions.appendChild(replyBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'admin-btn danger';
    deleteBtn.textContent = 'Supprimer';
    deleteBtn.addEventListener('click', () => deleteComment(comment.id));
    actions.appendChild(deleteBtn);

    const replyForm = document.createElement('div');
    replyForm.className = 'admin-reply-form';
    const replyTextarea = document.createElement('textarea');
    replyTextarea.placeholder = 'Votre réponse...';
    replyTextarea.maxLength = 2000;
    const replyActions = document.createElement('div');
    replyActions.className = 'reply-actions';
    const sendReply = document.createElement('button');
    sendReply.type = 'button';
    sendReply.className = 'admin-btn';
    sendReply.textContent = 'Publier la réponse';
    const cancelReply = document.createElement('button');
    cancelReply.type = 'button';
    cancelReply.className = 'admin-btn ghost';
    cancelReply.textContent = 'Annuler';
    replyActions.appendChild(sendReply);
    replyActions.appendChild(cancelReply);
    replyForm.appendChild(replyTextarea);
    replyForm.appendChild(replyActions);

    replyBtn.addEventListener('click', () => {
      replyForm.classList.toggle('open');
      if (replyForm.classList.contains('open')) replyTextarea.focus();
    });
    cancelReply.addEventListener('click', () => {
      replyForm.classList.remove('open');
      replyTextarea.value = '';
    });
    sendReply.addEventListener('click', async () => {
      const text = replyTextarea.value.trim();
      if (text.length < 1) return;
      sendReply.disabled = true;
      await postAdminReply(comment, text);
      sendReply.disabled = false;
    });

    row.appendChild(head);
    row.appendChild(body);
    row.appendChild(actions);
    row.appendChild(replyForm);
    return row;
  }

  function renderList(container, comments, isPending) {
    container.innerHTML = '';
    if (!comments || comments.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'admin-empty';
      empty.textContent = isPending ? 'Aucun commentaire en attente.' : 'Aucun commentaire approuvé.';
      container.appendChild(empty);
      return;
    }
    comments.forEach(c => container.appendChild(renderRow(c, isPending)));
  }

  async function refreshLists() {
    const [{ data: pending, error: pendingErr }, { data: approved, error: approvedErr }] = await Promise.all([
      client.from('comments').select('*').eq('approved', false).order('created_at', { ascending: false }),
      client.from('comments').select('*').eq('approved', true).order('created_at', { ascending: false }).limit(50)
    ]);
    if (pendingErr || approvedErr) {
      setActionStatus(`Erreur de chargement: ${(pendingErr || approvedErr).message}`, 'is-error');
      return;
    }
    renderList(pendingListEl, pending || [], true);
    renderList(approvedListEl, approved || [], false);
  }

  async function approveComment(id) {
    const { error } = await client.from('comments').update({ approved: true }).eq('id', id);
    if (error) { setActionStatus(`Erreur: ${error.message}`, 'is-error'); return; }
    setActionStatus('Commentaire approuvé.', 'is-success');
    refreshLists();
  }

  async function deleteComment(id) {
    if (!confirm('Supprimer ce commentaire ? Les réponses qui en dépendent seront aussi supprimées.')) return;
    const { error } = await client.from('comments').delete().eq('id', id);
    if (error) { setActionStatus(`Erreur: ${error.message}`, 'is-error'); return; }
    setActionStatus('Commentaire supprimé.', 'is-success');
    refreshLists();
  }

  async function postAdminReply(parentComment, text) {
    const { data: { session } } = await client.auth.getSession();
    const adminName = session && session.user && session.user.email
      ? session.user.email.split('@')[0]
      : 'Auteur';
    const { error } = await client.from('comments').insert({
      post_slug: parentComment.post_slug,
      parent_id: parentComment.id,
      author_name: adminName,
      body: text,
      approved: true,
      is_admin: true
    });
    if (error) { setActionStatus(`Erreur: ${error.message}`, 'is-error'); return; }
    setActionStatus('Réponse publiée.', 'is-success');
    refreshLists();
  }

  // --- Posts (journal) ---
  const postEditor = document.getElementById('post-editor');
  const postIdInput = document.getElementById('post-id');
  const postTitleInput = document.getElementById('post-title');
  const postSlugInput = document.getElementById('post-slug');
  const postBodyInput = document.getElementById('post-body');
  const postStatus = document.getElementById('post-status');
  const postsListEl = document.getElementById('posts-list');
  const newPostBtn = document.getElementById('new-post-btn');
  const postSaveDraftBtn = document.getElementById('post-save-draft-btn');
  const postPublishBtn = document.getElementById('post-publish-btn');
  const postCancelBtn = document.getElementById('post-cancel-btn');
  const postToolItalic = document.getElementById('post-tool-italic');

  let _slugManuallyEdited = false;
  const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  function slugify(str) {
    return String(str)
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120);
  }

  function setPostStatus(msg, type = '') {
    if (!postStatus) return;
    postStatus.textContent = msg;
    postStatus.classList.remove('is-error', 'is-success');
    if (type) postStatus.classList.add(type);
    if (msg && type === 'is-success') {
      setTimeout(() => { if (postStatus.textContent === msg) setPostStatus(''); }, 3500);
    }
  }

  function openPostEditor(post) {
    postEditor.style.display = '';
    if (post) {
      postIdInput.value = post.id;
      postTitleInput.value = post.title || '';
      postSlugInput.value = post.slug || '';
      postBodyInput.value = post.body || '';
      _slugManuallyEdited = true;
    } else {
      postIdInput.value = '';
      postTitleInput.value = '';
      postSlugInput.value = '';
      postBodyInput.value = '';
      _slugManuallyEdited = false;
    }
    setPostStatus('');
    postTitleInput.focus();
    postEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closePostEditor() {
    postEditor.style.display = 'none';
    postIdInput.value = '';
  }

  postTitleInput.addEventListener('input', () => {
    if (!_slugManuallyEdited) postSlugInput.value = slugify(postTitleInput.value);
  });
  postSlugInput.addEventListener('input', () => { _slugManuallyEdited = true; });

  postToolItalic.addEventListener('click', () => {
    const ta = postBodyInput;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = ta.value.slice(0, start);
    const selected = ta.value.slice(start, end);
    const after = ta.value.slice(end);
    const placeholder = selected || 'italique';
    ta.value = `${before}*${placeholder}*${after}`;
    ta.focus();
    ta.setSelectionRange(before.length + 1, before.length + 1 + placeholder.length);
  });

  async function savePost(publishNow) {
    const id = postIdInput.value.trim();
    const title = postTitleInput.value.trim();
    const slug = postSlugInput.value.trim();
    const body = postBodyInput.value.trim();

    if (!title) { setPostStatus('Le titre est requis.', 'is-error'); return; }
    if (!SLUG_RE.test(slug)) {
      setPostStatus('Slug invalide (minuscules, chiffres et tirets uniquement, pas de tiret en début/fin).', 'is-error');
      return;
    }
    if (!body) { setPostStatus('Le corps est requis.', 'is-error'); return; }

    postSaveDraftBtn.disabled = true;
    postPublishBtn.disabled = true;
    setPostStatus('Enregistrement…');

    const payload = { title, slug, body, published: !!publishNow };
    if (publishNow) payload.published_at = new Date().toISOString();

    let result;
    if (id) {
      result = await client.from('posts').update(payload).eq('id', id).select().single();
    } else {
      result = await client.from('posts').insert(payload).select().single();
    }

    postSaveDraftBtn.disabled = false;
    postPublishBtn.disabled = false;

    if (result.error) {
      const msg = result.error.code === '23505'
        ? 'Ce slug existe déjà — choisissez-en un autre.'
        : result.error.message;
      setPostStatus(`Erreur : ${msg}`, 'is-error');
      return;
    }
    setPostStatus(publishNow ? 'Article publié.' : 'Brouillon enregistré.', 'is-success');
    closePostEditor();
    refreshPosts();
  }

  async function deletePost(id) {
    if (!confirm('Supprimer cet article ? (Les commentaires associés ne seront pas supprimés.)')) return;
    const { error } = await client.from('posts').delete().eq('id', id);
    if (error) { setPostStatus(`Erreur : ${error.message}`, 'is-error'); return; }
    setPostStatus('Article supprimé.', 'is-success');
    refreshPosts();
  }

  async function togglePublish(post) {
    const next = !post.published;
    const update = { published: next };
    if (next && !post.published_at) update.published_at = new Date().toISOString();
    const { error } = await client.from('posts').update(update).eq('id', post.id);
    if (error) { setPostStatus(`Erreur : ${error.message}`, 'is-error'); return; }
    setPostStatus(next ? 'Article publié.' : 'Article dépublié.', 'is-success');
    refreshPosts();
  }

  function renderPostRow(post) {
    const row = document.createElement('div');
    row.className = 'admin-row';
    row.dataset.id = post.id;

    const head = document.createElement('div');
    head.className = 'admin-row-head';

    const title = document.createElement('span');
    title.className = 'admin-row-name';
    title.textContent = post.title || '(sans titre)';
    head.appendChild(title);

    const state = document.createElement('span');
    state.className = 'admin-row-slug';
    state.textContent = post.published ? 'publié' : 'brouillon';
    head.appendChild(state);

    const date = document.createElement('span');
    date.className = 'admin-row-date';
    date.textContent = formatDate(post.published_at || post.updated_at || post.created_at);
    head.appendChild(date);

    const meta = document.createElement('div');
    meta.className = 'admin-row-body';
    meta.style.fontSize = '11px';
    meta.style.color = 'var(--gray)';
    meta.textContent = `slug : ${post.slug}`;

    const actions = document.createElement('div');
    actions.className = 'admin-row-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'admin-btn ghost';
    editBtn.textContent = 'Modifier';
    editBtn.addEventListener('click', () => openPostEditor(post));
    actions.appendChild(editBtn);

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = post.published ? 'admin-btn ghost' : 'admin-btn';
    toggleBtn.textContent = post.published ? 'Dépublier' : 'Publier';
    toggleBtn.addEventListener('click', () => togglePublish(post));
    actions.appendChild(toggleBtn);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'admin-btn danger';
    delBtn.textContent = 'Supprimer';
    delBtn.addEventListener('click', () => deletePost(post.id));
    actions.appendChild(delBtn);

    row.appendChild(head);
    row.appendChild(meta);
    row.appendChild(actions);
    return row;
  }

  async function refreshPosts() {
    const { data, error } = await client
      .from('posts')
      .select('*')
      .order('published', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) {
      setPostStatus(`Erreur de chargement : ${error.message}`, 'is-error');
      return;
    }
    postsListEl.innerHTML = '';
    if (!data || data.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'admin-empty';
      empty.textContent = 'Aucun article pour le moment.';
      postsListEl.appendChild(empty);
      return;
    }
    data.forEach(p => postsListEl.appendChild(renderPostRow(p)));
  }

  newPostBtn.addEventListener('click', () => openPostEditor(null));
  postCancelBtn.addEventListener('click', closePostEditor);
  postSaveDraftBtn.addEventListener('click', () => savePost(false));
  postPublishBtn.addEventListener('click', () => savePost(true));

  // --- Auth flow ---
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = (loginEmail.value || '').trim();
    if (!email) return;
    setLoginStatus('Envoi du lien...');
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href }
    });
    if (error) {
      setLoginStatus(`Erreur: ${error.message}`, 'is-error');
      return;
    }
    setLoginStatus('Vérifiez votre boîte mail et cliquez le lien magique pour vous connecter.', 'is-success');
  });

  logoutBtn.addEventListener('click', async () => {
    await client.auth.signOut();
    showLogin();
    setLoginStatus('Déconnecté.', 'is-success');
  });

  client.auth.getSession().then(({ data }) => {
    if (data && data.session) showDashboard(data.session);
    else showLogin();
  });

  client.auth.onAuthStateChange((event, session) => {
    if (session) showDashboard(session);
    else showLogin();
  });
})();
