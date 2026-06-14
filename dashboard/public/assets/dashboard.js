'use strict';

(function () {
  // ── State ─────────────────────────────────────────────────────────────────
  let currentProject = null;
  let currentBuildId = null;
  let eventSource = null;
  let pendingIconFile = null;
  let pendingSplashFile = null;

  // ── Auth guard ────────────────────────────────────────────────────────────
  const token = localStorage.getItem('twa_token');
  if (!token) {
    window.location.href = '/';
    return;
  }

  document.getElementById('userEmail').textContent = localStorage.getItem('twa_email') || '';

  // ── API helper ────────────────────────────────────────────────────────────
  async function api(method, urlPath, body) {
    const opts = {
      method,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    };
    if (body !== undefined) opts.body = JSON.stringify(body);

    const res = await fetch(urlPath, opts);
    if (res.status === 401) {
      localStorage.removeItem('twa_token');
      localStorage.removeItem('twa_email');
      window.location.href = '/';
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  async function apiForm(method, urlPath, formData) {
    const res = await fetch(urlPath, {
      method,
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });
    if (res.status === 401) {
      localStorage.removeItem('twa_token');
      window.location.href = '/';
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  // ── View management ───────────────────────────────────────────────────────
  function showView(viewId) {
    document.querySelectorAll('.view').forEach((v) => v.classList.add('d-none'));
    document.getElementById(viewId).classList.remove('d-none');
  }

  // ── Project list ──────────────────────────────────────────────────────────
  async function loadProjects() {
    try {
      const projects = await api('GET', '/api/projects');
      renderProjectList(projects);

      if (projects.length === 0) {
        showView('viewEmpty');
      } else if (!currentProject) {
        showView('viewEmpty');
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  }

  function renderProjectList(projects) {
    const list = document.getElementById('projectList');
    list.innerHTML = '';
    projects.forEach((p) => {
      const div = document.createElement('div');
      div.className = 'project-item' + (currentProject && currentProject.id === p.id ? ' active' : '');
      div.textContent = p.name || p.config.appName || 'Unnamed';
      div.title = p.config.packageName || '';
      div.addEventListener('click', () => selectProject(p));
      list.appendChild(div);
    });
  }

  async function selectProject(project) {
    currentProject = project;
    // Re-fetch to get latest
    try {
      currentProject = await api('GET', `/api/projects/${project.id}`);
    } catch { /* use cached */ }
    populateForm(currentProject);
    showView('viewProjectForm');
    document.querySelectorAll('.project-item').forEach((el) => {
      el.classList.toggle('active', el.title === (currentProject.config.packageName || ''));
    });
    // Re-render with active state
    loadProjects();
  }

  // ── Project form ──────────────────────────────────────────────────────────
  function populateForm(project) {
    const f = document.getElementById('projectForm');
    const cfg = project.config || {};

    f.querySelector('[name=appName]').value = cfg.appName || '';
    f.querySelector('[name=packageName]').value = cfg.packageName || '';
    f.querySelector('[name=websiteUrl]').value = cfg.websiteUrl || '';
    f.querySelector('[name=versionName]').value = (cfg.version && cfg.version.name) || '1.0.0';
    f.querySelector('[name=versionCode]').value = (cfg.version && cfg.version.code) || 1;

    const primary = (cfg.theme && cfg.theme.primary) || '#6200EE';
    const bg = (cfg.theme && cfg.theme.background) || '#FFFFFF';
    f.querySelector('[name=primaryColor]').value = primary;
    f.querySelector('[name=primaryColorHex]').value = primary;
    f.querySelector('[name=backgroundColor]').value = bg;
    f.querySelector('[name=backgroundColorHex]').value = bg;

    const features = cfg.features || {};
    ['fullscreen','notifications','camera','location','fileUpload','biometric','qrScanner','offline'].forEach((feat) => {
      const el = f.querySelector(`[name=feat_${feat}]`);
      if (el) el.checked = !!features[feat];
    });

    const plugins = cfg.plugins || [];
    ['notification','biometric','qr-scanner','downloader','payments'].forEach((p) => {
      const el = f.querySelector(`[name=plugin_${p}]`);
      if (el) el.checked = plugins.includes(p);
    });

    const firebase = cfg.firebase || {};
    f.querySelector('[name=firebaseEnabled]').checked = !!firebase.enabled;
    document.getElementById('firebaseFields').style.display = firebase.enabled ? '' : 'none';
    f.querySelector('[name=firebaseProjectId]').value = firebase.projectId || '';
    f.querySelector('[name=firebaseAppId]').value = firebase.appId || '';
    f.querySelector('[name=firebaseApiKey]').value = firebase.apiKey || '';

    // Update form title and action buttons
    document.getElementById('formTitle').textContent = project.name || 'Edit Project';
    document.getElementById('generateBtn').disabled = false;
    document.getElementById('buildApkBtn').disabled = false;
    document.getElementById('buildAabBtn').disabled = false;
    document.getElementById('deleteProjectBtn').style.display = '';
    document.getElementById('viewBuildsBtn').style.display = '';

    // Reset pending uploads
    pendingIconFile = null;
    pendingSplashFile = null;
    resetUploadZone('icon');
    resetUploadZone('splash');
  }

  function resetUploadZone(type) {
    const placeholder = document.getElementById(`${type}Placeholder`);
    const preview = document.getElementById(`${type}Preview`);
    placeholder.classList.remove('d-none');
    preview.classList.add('d-none');
    preview.src = '';
  }

  function clearForm() {
    const f = document.getElementById('projectForm');
    f.reset();
    document.getElementById('formTitle').textContent = 'New Project';
    document.getElementById('generateBtn').disabled = true;
    document.getElementById('buildApkBtn').disabled = true;
    document.getElementById('buildAabBtn').disabled = true;
    document.getElementById('deleteProjectBtn').style.display = 'none';
    document.getElementById('viewBuildsBtn').style.display = 'none';
    document.getElementById('firebaseFields').style.display = 'none';
    resetUploadZone('icon');
    resetUploadZone('splash');
    pendingIconFile = null;
    pendingSplashFile = null;
    currentProject = null;
  }

  function gatherConfig() {
    const f = document.getElementById('projectForm');
    const data = Object.fromEntries(new FormData(f));

    const plugins = [];
    ['notification','biometric','qr-scanner','downloader','payments'].forEach((p) => {
      if (data[`plugin_${p}`]) plugins.push(p);
    });

    return {
      appName: (data.appName || '').trim(),
      packageName: (data.packageName || '').trim(),
      websiteUrl: (data.websiteUrl || '').trim(),
      version: {
        name: (data.versionName || '1.0.0').trim(),
        code: parseInt(data.versionCode, 10) || 1,
      },
      theme: {
        primary: data.primaryColorHex || data.primaryColor || '#6200EE',
        background: data.backgroundColorHex || data.backgroundColor || '#FFFFFF',
      },
      features: {
        fullscreen: !!data.feat_fullscreen,
        notifications: !!data.feat_notifications,
        camera: !!data.feat_camera,
        location: !!data.feat_location,
        fileUpload: !!data.feat_fileUpload,
        biometric: !!data.feat_biometric,
        qrScanner: !!data.feat_qrScanner,
        offline: !!data.feat_offline,
      },
      plugins,
      firebase: {
        enabled: !!data.firebaseEnabled,
        projectId: (data.firebaseProjectId || '').trim(),
        appId: (data.firebaseAppId || '').trim(),
        apiKey: (data.firebaseApiKey || '').trim(),
      },
    };
  }

  async function saveProject() {
    const config = gatherConfig();
    const btn = document.getElementById('saveProjectBtn');
    const spinner = document.getElementById('saveSpinner');

    btn.disabled = true;
    spinner.classList.remove('d-none');

    try {
      let project;
      if (currentProject) {
        project = await api('PUT', `/api/projects/${currentProject.id}`, { config });
      } else {
        project = await api('POST', '/api/projects', { config });
      }

      currentProject = project;

      // Upload pending files
      if (pendingIconFile) await uploadIcon(pendingIconFile);
      if (pendingSplashFile) await uploadSplash(pendingSplashFile);

      loadProjects();
      populateForm(currentProject);
      showToast('Project saved!', 'success');
    } catch (err) {
      showToast('Save failed: ' + err.message, 'danger');
    } finally {
      btn.disabled = false;
      spinner.classList.add('d-none');
    }
  }

  async function uploadIcon(file) {
    if (!currentProject) return;
    const fd = new FormData();
    fd.append('icon', file);
    try {
      await apiForm('POST', `/api/projects/${currentProject.id}/icon`, fd);
    } catch (err) {
      console.warn('Icon upload failed:', err.message);
    }
  }

  async function uploadSplash(file) {
    if (!currentProject) return;
    const fd = new FormData();
    fd.append('splash', file);
    try {
      await apiForm('POST', `/api/projects/${currentProject.id}/splash`, fd);
    } catch (err) {
      console.warn('Splash upload failed:', err.message);
    }
  }

  async function triggerBuild(variant, format) {
    if (!currentProject) return;

    try {
      const result = await api('POST', '/api/builds', {
        projectId: currentProject.id,
        variant,
        format,
      });
      currentBuildId = result.buildId;
      showBuildLog(result);
      startBuildStream(result.buildId);
    } catch (err) {
      showToast('Failed to start build: ' + err.message, 'danger');
    }
  }

  function showBuildLog(buildInfo) {
    showView('viewBuildLog');
    document.getElementById('buildLogOutput').textContent = '';
    updateBuildStatus(buildInfo.status || 'queued');
    document.getElementById('buildVariantBadge').textContent = buildInfo.variant || '-';
    document.getElementById('buildFormatBadge').textContent = buildInfo.format || '-';
    document.getElementById('buildSpinner').classList.remove('d-none');
    document.getElementById('downloadSection').classList.add('d-none');
    document.getElementById('downloadButtons').innerHTML = '';
  }

  function updateBuildStatus(status) {
    const badge = document.getElementById('buildStatusBadge');
    badge.textContent = status;
    badge.className = `badge fs-6 status-${status}`;
  }

  function startBuildStream(buildId) {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }

    const url = `/api/builds/${buildId}/stream`;
    const es = new EventSource(url, {
      // We need auth header — EventSource doesn't support it natively
      // Use polling fallback via fetch for SSE with auth
    });

    // EventSource doesn't support custom headers, use fetch-based SSE
    es.close();
    fetchSSE(buildId);
  }

  async function fetchSSE(buildId) {
    const logEl = document.getElementById('buildLogOutput');

    try {
      const res = await fetch(`/api/builds/${buildId}/stream`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!res.ok) {
        logEl.textContent += '\n[ERROR] Could not connect to build stream';
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              handleBuildEvent(event, buildId, logEl);
            } catch { /* ignore parse errors */ }
          }
        }
      }
    } catch (err) {
      if (logEl) logEl.textContent += `\n[ERROR] Stream error: ${err.message}`;
    }
  }

  function handleBuildEvent(event, buildId, logEl) {
    if (event.type === 'log') {
      logEl.textContent += event.message + '\n';
      logEl.scrollTop = logEl.scrollHeight;
    } else if (event.type === 'status') {
      updateBuildStatus(event.status);
      if (event.status === 'building' || event.status === 'generating') {
        document.getElementById('buildSpinner').classList.remove('d-none');
      }
    } else if (event.type === 'complete') {
      updateBuildStatus(event.status);
      document.getElementById('buildSpinner').classList.add('d-none');
      if (event.artifactPaths && event.artifactPaths.length > 0) {
        showDownloadButtons(buildId, event.artifactPaths);
      }
    } else if (event.type === 'error') {
      updateBuildStatus('failed');
      document.getElementById('buildSpinner').classList.add('d-none');
      logEl.textContent += `\n[FAILED] ${event.error}`;
      logEl.scrollTop = logEl.scrollHeight;
    }
  }

  function showDownloadButtons(buildId, artifactPaths) {
    const section = document.getElementById('downloadSection');
    const buttons = document.getElementById('downloadButtons');
    section.classList.remove('d-none');
    buttons.innerHTML = '';

    artifactPaths.forEach((artifactPath) => {
      const filename = artifactPath.split('/').pop();
      const btn = document.createElement('a');
      btn.href = `/api/downloads/${buildId}/${encodeURIComponent(filename)}`;
      btn.className = 'btn btn-success';
      btn.download = filename;
      btn.textContent = `Download ${filename}`;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        downloadArtifact(buildId, filename);
      });
      buttons.appendChild(btn);
    });
  }

  function downloadArtifact(buildId, filename) {
    // Create a hidden link with auth not possible for download — redirect with token in query
    // Instead open a fetch-based download
    fetch(`/api/downloads/${buildId}/${encodeURIComponent(filename)}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    }).then((res) => {
      if (!res.ok) throw new Error('Download failed');
      return res.blob();
    }).then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }).catch((err) => showToast('Download failed: ' + err.message, 'danger'));
  }

  async function loadBuildsHistory() {
    if (!currentProject) return;
    showView('viewBuildsHistory');
    try {
      const builds = await api('GET', '/api/builds');
      const projectBuilds = builds.filter((b) => b.projectId === currentProject.id);
      renderBuildsTable(projectBuilds);
    } catch (err) {
      showToast('Failed to load builds: ' + err.message, 'danger');
    }
  }

  function renderBuildsTable(builds) {
    const tbody = document.getElementById('buildsTableBody');
    if (builds.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-muted text-center">No builds yet</td></tr>';
      return;
    }
    tbody.innerHTML = builds.map((b) => {
      const date = new Date(b.createdAt).toLocaleString();
      const statusClass = `status-${b.status}`;
      const artifacts = (b.artifactPaths || []).map((p) => {
        const fname = p.split('/').pop();
        return `<button class="btn btn-sm btn-success" onclick="window._downloadArtifact('${b.id}','${fname}')">&#8659; ${fname}</button>`;
      }).join(' ');
      return `<tr>
        <td>${date}</td>
        <td>${b.variant}</td>
        <td>${b.format}</td>
        <td><span class="badge ${statusClass}">${b.status}</span></td>
        <td>
          <button class="btn btn-sm btn-outline-primary me-1" onclick="window._viewBuildLog('${b.id}')">View Log</button>
          ${artifacts}
          <button class="btn btn-sm btn-outline-danger" onclick="window._deleteBuild('${b.id}')">Delete</button>
        </td>
      </tr>`;
    }).join('');
  }

  // Expose helpers for inline onclick handlers
  window._downloadArtifact = downloadArtifact;
  window._viewBuildLog = async function (buildId) {
    currentBuildId = buildId;
    try {
      const build = await api('GET', `/api/builds/${buildId}`);
      showBuildLog(build);
      // Replay existing log
      const logEl = document.getElementById('buildLogOutput');
      logEl.textContent = (build.log || []).join('\n');
      logEl.scrollTop = logEl.scrollHeight;
      updateBuildStatus(build.status);
      if (build.artifactPaths && build.artifactPaths.length > 0) {
        showDownloadButtons(buildId, build.artifactPaths);
      }
      document.getElementById('buildSpinner').classList.add('d-none');
    } catch (err) {
      showToast('Failed to load build: ' + err.message, 'danger');
    }
  };
  window._deleteBuild = async function (buildId) {
    if (!confirm('Delete this build record?')) return;
    try {
      await api('DELETE', `/api/builds/${buildId}`);
      loadBuildsHistory();
    } catch (err) {
      showToast('Delete failed: ' + err.message, 'danger');
    }
  };

  // ── Upload zones ──────────────────────────────────────────────────────────
  function setupUploadZone(type, maxMB) {
    const zone = document.getElementById(`${type}DropZone`);
    const input = document.getElementById(`${type}File`);
    const placeholder = document.getElementById(`${type}Placeholder`);
    const preview = document.getElementById(`${type}Preview`);

    zone.addEventListener('click', () => input.click());

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file, type, maxMB, preview, placeholder);
    });

    input.addEventListener('change', () => {
      const file = input.files[0];
      if (file) handleFileSelect(file, type, maxMB, preview, placeholder);
    });
  }

  function handleFileSelect(file, type, maxMB, preview, placeholder) {
    if (!['image/png','image/jpeg','image/webp'].includes(file.type)) {
      showToast('Only PNG, JPG, WebP allowed', 'danger');
      return;
    }
    if (file.size > maxMB * 1024 * 1024) {
      showToast(`File too large (max ${maxMB}MB)`, 'danger');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      preview.src = e.target.result;
      preview.classList.remove('d-none');
      placeholder.classList.add('d-none');
    };
    reader.readAsDataURL(file);

    if (type === 'icon') pendingIconFile = file;
    else pendingSplashFile = file;
  }

  // ── Toast helper ──────────────────────────────────────────────────────────
  function showToast(message, type) {
    // Simple alert at top of main area
    const existing = document.getElementById('dashToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'dashToast';
    toast.className = `alert alert-${type} alert-dismissible position-fixed top-0 end-0 m-3`;
    toast.style.zIndex = '9999';
    toast.innerHTML = `${message}<button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  // ── Color picker sync ─────────────────────────────────────────────────────
  function syncColorPicker(colorName, hexName) {
    const colorInput = document.querySelector(`[name=${colorName}]`);
    const hexInput = document.querySelector(`[name=${hexName}]`);
    if (!colorInput || !hexInput) return;

    colorInput.addEventListener('input', () => { hexInput.value = colorInput.value; });
    hexInput.addEventListener('input', () => {
      if (/^#[0-9A-Fa-f]{6}$/.test(hexInput.value)) {
        colorInput.value = hexInput.value;
      }
    });
  }

  // ── Event bindings ────────────────────────────────────────────────────────
  document.getElementById('newProjectBtn').addEventListener('click', () => {
    clearForm();
    showView('viewProjectForm');
    document.querySelectorAll('.project-item').forEach((el) => el.classList.remove('active'));
  });

  document.getElementById('emptyNewProjectBtn').addEventListener('click', () => {
    clearForm();
    showView('viewProjectForm');
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('twa_token');
    localStorage.removeItem('twa_email');
    window.location.href = '/';
  });

  document.getElementById('projectForm').addEventListener('submit', (e) => {
    e.preventDefault();
    saveProject();
  });

  document.getElementById('generateBtn').addEventListener('click', () => {
    triggerBuild('debug', 'generate');
  });

  document.getElementById('buildApkBtn').addEventListener('click', () => {
    triggerBuild('debug', 'apk');
  });

  document.getElementById('buildAabBtn').addEventListener('click', () => {
    triggerBuild('release', 'aab');
  });

  document.getElementById('deleteProjectBtn').addEventListener('click', async () => {
    if (!currentProject) return;
    if (!confirm(`Delete project "${currentProject.name}"? This cannot be undone.`)) return;
    try {
      await api('DELETE', `/api/projects/${currentProject.id}`);
      currentProject = null;
      clearForm();
      showView('viewEmpty');
      loadProjects();
    } catch (err) {
      showToast('Delete failed: ' + err.message, 'danger');
    }
  });

  document.getElementById('backToProjectBtn').addEventListener('click', () => {
    if (currentProject) {
      populateForm(currentProject);
      showView('viewProjectForm');
    } else {
      showView('viewEmpty');
    }
    if (eventSource) { eventSource.close(); eventSource = null; }
  });

  document.getElementById('backFromHistoryBtn').addEventListener('click', () => {
    if (currentProject) {
      populateForm(currentProject);
      showView('viewProjectForm');
    } else {
      showView('viewEmpty');
    }
  });

  document.getElementById('viewBuildsBtn').addEventListener('click', loadBuildsHistory);

  document.getElementById('firebaseEnabled').addEventListener('change', function () {
    document.getElementById('firebaseFields').style.display = this.checked ? '' : 'none';
  });

  // Setup upload zones
  setupUploadZone('icon', 5);
  setupUploadZone('splash', 10);

  // Setup color pickers
  syncColorPicker('primaryColor', 'primaryColorHex');
  syncColorPicker('backgroundColor', 'backgroundColorHex');

  // ── Init ──────────────────────────────────────────────────────────────────
  showView('viewEmpty');
  loadProjects();
})();
