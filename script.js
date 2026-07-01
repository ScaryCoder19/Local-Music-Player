(function(){
  let tracks = [];

  const audio        = document.getElementById('audio');
  const disc          = document.getElementById('disc');
  const tonearmWrap    = document.getElementById('tonearmWrap');
  const eq            = document.getElementById('eq');
  const labelInitials  = document.getElementById('labelInitials');
  const trackTitle     = document.getElementById('trackTitle');
  const trackArtist    = document.getElementById('trackArtist');
  const currentTimeEl  = document.getElementById('currentTime');
  const totalTimeEl    = document.getElementById('totalTime');
  const progress       = document.getElementById('progress');
  const playBtn        = document.getElementById('playBtn');
  const playIcon       = document.getElementById('playIcon');
  const pauseIcon      = document.getElementById('pauseIcon');
  const loadBtn        = document.getElementById('loadBtn');
  const fileInput      = document.getElementById('fileInput');
  const prevBtn        = document.getElementById('prevBtn');
  const nextBtn        = document.getElementById('nextBtn');
  const shuffleBtn     = document.getElementById('shuffleBtn');
  const repeatBtn      = document.getElementById('repeatBtn');
  const repeatBadge    = document.getElementById('repeatBadge');
  const volBtn         = document.getElementById('volBtn');
  const volIconOn      = document.getElementById('volIconOn');
  const volIconOff     = document.getElementById('volIconOff');
  const volume         = document.getElementById('volume');
  const tracklistEl    = document.getElementById('tracklist');
  const trackCountEl   = document.getElementById('trackCount');

  let currentIndex = 0;
  let isPlaying = false;
  let shuffleOn = false;
  let repeatMode = 'off'; // 'off' | 'all' | 'one'
  let lastVolume = 70;
  let isScrubbing = false;

  const audioExtensions = new Set(['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus', 'webm', 'mp4', 'm4b']);

  function revokeTrackUrls(list){
    list.forEach((track) => {
      if (track.isLocal && track.src) {
        URL.revokeObjectURL(track.src);
      }
    });
  }

  function stripExtension(fileName){
    return fileName.replace(/\.[^.]+$/, '');
  }

  function isSupportedAudioFile(file){
    if (file.type && file.type.startsWith('audio/')) return true;
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    return audioExtensions.has(extension);
  }

  function buildTrackFromFile(file){
    const folder = file.webkitRelativePath ? file.webkitRelativePath.split('/').slice(0, -1).join(' / ') : '';
    return {
      title: stripExtension(file.name) || file.name,
      artist: folder || 'Local file',
      src: URL.createObjectURL(file),
      isLocal: true
    };
  }

  function clearNowPlaying(){
    trackTitle.textContent = '—';
    trackArtist.textContent = 'Select local audio files';
    labelInitials.textContent = '—';
    currentTimeEl.textContent = '00:00';
    totalTimeEl.textContent = '00:00';
    progress.value = 0;
    fillSlider(progress, 0);
  }

  function formatTime(sec){
    if (!isFinite(sec) || sec < 0) return "00:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return String(m).padStart(2,'0') + ":" + String(s).padStart(2,'0');
  }

  function initials(name){
    return name.split(/\s+/).map(w => w[0]).join('').slice(0,3).toUpperCase();
  }

  function fillSlider(el, pct){
    el.style.background = `linear-gradient(to right, var(--amber) ${pct}%, rgba(242,233,216,0.12) ${pct}%)`;
  }

  // playlist
  function renderPlaylist(){
    tracklistEl.innerHTML = '';
    if (!tracks.length){
      const li = document.createElement('li');
      li.className = 'track-item empty';
      li.textContent = 'Add some music to get started.';
      tracklistEl.appendChild(li);
      trackCountEl.textContent = '0 tracks';
      clearNowPlaying();
      return;
    }

    tracks.forEach((t, i) => {
      const li = document.createElement('li');
      li.className = 'track-item' + (i === currentIndex ? ' active' : '');
      li.setAttribute('role','button');
      li.setAttribute('tabindex','0');

      li.innerHTML = `
        <span class="track-num">${String(i+1).padStart(2,'0')}</span>
        <span class="track-eq">
          <span class="eq${i === currentIndex ? ' live' : ''}" data-role="mini-eq"><span></span><span></span><span></span></span>
        </span>
        <span class="track-meta">
          <span class="t-title">${t.title}</span>
          <span class="t-artist">${t.artist}</span>
        </span>
        <span class="t-duration" data-role="duration">--:--</span>
      `;

      li.addEventListener('click', () => { loadTrack(i); play(); });
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); loadTrack(i); play(); }
      });

      tracklistEl.appendChild(li);
    });
    trackCountEl.textContent = tracks.length + ' tracks';
    syncPlaylistActiveStates();
    preloadDurations();
  }

  function syncPlaylistActiveStates(){
    [...tracklistEl.children].forEach((li, i) => {
      li.classList.toggle('active', i === currentIndex);
      const miniEq = li.querySelector('[data-role="mini-eq"]');
      if (miniEq) {
        miniEq.classList.toggle('live', i === currentIndex && isPlaying);
      }
    });
  }

  function preloadDurations(){
    if (!tracks.length) return;
    tracks.forEach((t, i) => {
      const probe = new Audio();
      probe.preload = 'metadata';
      probe.src = t.src;
      probe.addEventListener('loadedmetadata', () => {
        const durEl = tracklistEl.children[i]?.querySelector('[data-role="duration"]');
        if (durEl) durEl.textContent = formatTime(probe.duration);
      }, { once:true });
    });
  }

  // track loading & transport
  function loadTrack(index){
    if (!tracks.length) return;
    currentIndex = (index + tracks.length) % tracks.length;
    const t = tracks[currentIndex];
    audio.src = t.src;
    trackTitle.textContent = t.title;
    trackArtist.textContent = t.artist;
    labelInitials.textContent = initials(t.artist);
    progress.value = 0;
    fillSlider(progress, 0);
    currentTimeEl.textContent = "00:00";
    totalTimeEl.textContent = "00:00";
    syncPlaylistActiveStates();
  }

  function play(){
    if (!tracks.length) return;
    audio.play().then(() => {
      isPlaying = true;
      updatePlayState();
    }).catch(() => { /* autoplay was blocked; user gesture required */ });
  }

  function pause(){
    audio.pause();
    isPlaying = false;
    updatePlayState();
  }

  function updatePlayState(){
    playIcon.style.display  = isPlaying ? 'none' : '';
    pauseIcon.style.display = isPlaying ? '' : 'none';
    playBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
    disc.classList.toggle('playing', isPlaying);
    tonearmWrap.classList.toggle('playing', isPlaying);
    eq.classList.toggle('live', isPlaying);
    syncPlaylistActiveStates();
  }

  function nextIndex(){
    if (!tracks.length) return 0;
    if (shuffleOn){
      if (tracks.length === 1) return currentIndex;
      let r;
      do { r = Math.floor(Math.random() * tracks.length); } while (r === currentIndex);
      return r;
    }
    return (currentIndex + 1) % tracks.length;
  }

  function prevIndex(){
    if (!tracks.length) return 0;
    if (shuffleOn){
      if (tracks.length === 1) return currentIndex;
      let r;
      do { r = Math.floor(Math.random() * tracks.length); } while (r === currentIndex);
      return r;
    }
    return (currentIndex - 1 + tracks.length) % tracks.length;
  }

  function goNext(){
    if (!tracks.length) return;
    loadTrack(nextIndex());
    play();
  }
  function goPrev(){
    if (!tracks.length) return;
    // if a few seconds into the track, restart it instead of jumping back (common player UX)
    if (audio.currentTime > 3){ audio.currentTime = 0; return; }
    loadTrack(prevIndex()); play();
  }

  function loadLocalFiles(fileList){
    const selectedFiles = [...fileList].filter(isSupportedAudioFile);
    revokeTrackUrls(tracks);
    tracks = selectedFiles
      .sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name))
      .map(buildTrackFromFile);
    currentIndex = 0;
    renderPlaylist();
    if (tracks.length){
      loadTrack(0);
      play();
    }
  }

  // transport buttons
  loadBtn.addEventListener('click', () => {
    fileInput.value = '';
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    loadLocalFiles(fileInput.files || []);
  });

  playBtn.addEventListener('click', () => { isPlaying ? pause() : play(); });
  nextBtn.addEventListener('click', goNext);
  prevBtn.addEventListener('click', goPrev);

  shuffleBtn.addEventListener('click', () => {
    shuffleOn = !shuffleOn;
    shuffleBtn.classList.toggle('active', shuffleOn);
  });

  repeatBtn.addEventListener('click', () => {
    repeatMode = repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off';
    repeatBtn.classList.toggle('active', repeatMode !== 'off');
    repeatBadge.style.display = repeatMode === 'one' ? 'flex' : 'none';
    repeatBtn.title = repeatMode === 'off' ? 'Repeat' : repeatMode === 'all' ? 'Repeat all' : 'Repeat one';
  });

  // autoplay & repeat handling
  audio.addEventListener('ended', () => {
    if (!tracks.length) return;
    if (repeatMode === 'one'){
      audio.currentTime = 0;
      play();
      return;
    }
    const atEnd = currentIndex === tracks.length - 1 && !shuffleOn;
    if (atEnd && repeatMode === 'off'){
      pause();
      loadTrack(0);
      return;
    }
    goNext();
  });

  // progress / seeking
  audio.addEventListener('timeupdate', () => {
    if (!tracks.length) return;
    if (isScrubbing) return;
    const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    progress.value = pct;
    fillSlider(progress, pct);
    currentTimeEl.textContent = formatTime(audio.currentTime);
  });

  audio.addEventListener('loadedmetadata', () => {
    if (!tracks.length) return;
    totalTimeEl.textContent = formatTime(audio.duration);
    const durEl = tracklistEl.children[currentIndex]?.querySelector('[data-role="duration"]');
    if (durEl) durEl.textContent = formatTime(audio.duration);
  });

  progress.addEventListener('input', () => {
    isScrubbing = true;
    fillSlider(progress, progress.value);
    if (audio.duration){
      currentTimeEl.textContent = formatTime((progress.value/100) * audio.duration);
    }
  });
  progress.addEventListener('change', () => {
    if (audio.duration){
      audio.currentTime = (progress.value/100) * audio.duration;
    }
    isScrubbing = false;
  });

  // volume
  function setVolume(v){
    audio.volume = v/100;
    volIconOn.style.display  = v > 0 ? '' : 'none';
    volIconOff.style.display = v > 0 ? 'none' : '';
    fillSlider(volume, v);
  }

  volume.addEventListener('input', () => {
    const v = Number(volume.value);
    if (v > 0) lastVolume = v;
    setVolume(v);
  });

  volBtn.addEventListener('click', () => {
    if (Number(volume.value) > 0){
      lastVolume = Number(volume.value);
      volume.value = 0;
    } else {
      volume.value = lastVolume || 70;
    }
    setVolume(Number(volume.value));
  });

  // keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (!tracks.length) return;
    if (e.code === 'Space'){ e.preventDefault(); isPlaying ? pause() : play(); }
    if (e.code === 'ArrowRight'){ goNext(); }
    if (e.code === 'ArrowLeft'){ goPrev(); }
  });

  // init
  renderPlaylist();
  loadTrack(0);
  setVolume(Number(volume.value));
  fillSlider(progress, 0);
})();