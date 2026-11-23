/**
 * 사자성어 마스터! - 중학교 1~3학년 인터랙티브 사자성어 학습 게임 엔진 (app.js)
 * - 525개 사자성어 + 838개 한자 훈·음 분해 데이터 연동
 * - LEVEL 1 ~ LEVEL 5 잠금 해제 및 별(★) 획득 시스템
 * - STEP 1(학습하기), STEP 2(객관식 퀴즈), STEP 3(한자 빈칸 타임어택), STEP 4(상황별 찾기), STEP 5(최종 도전 10문항)
 * - 점수(기본 10점 + 연속 콤보 보너스 + 제한 시간 스피드 보너스) 및 칭호(새싹~마스터) 시스템
 * - 오늘의 사자성어, 틀린 문제 다시 풀기, 학습한 사자성어 모아보기, 실시간 뜻·해설 찬스 모달
 */

(function () {
  "use strict";

  // ==========================================================================
  // 1. 레벨 정의 및 칭호 기준
  // ==========================================================================
  const LEVEL_CONFIGS = [
    {
      level: 1,
      title: "LEVEL 1: 기초 사자성어",
      subtitle: "중학생이라면 꼭 알아야 할 필수 기초 성어 105선",
      icon: "🌱",
      passScore: 60
    },
    {
      level: 2,
      title: "LEVEL 2: 일상생활 사자성어",
      subtitle: "대화, 감정, 친구 관계에서 자주 쓰는 성어 105선",
      icon: "🧭",
      passScore: 60
    },
    {
      level: 3,
      title: "LEVEL 3: 학교·교과 사자성어",
      subtitle: "국어·역사·도덕 교과서와 시험에 자주 나오는 성어 105선",
      icon: "🏫",
      passScore: 60
    },
    {
      level: 4,
      title: "LEVEL 4: 고난도 사자성어",
      subtitle: "어휘력과 문해력을 한 단계 높여 주는 심화 성어 105선",
      icon: "⚔️",
      passScore: 60
    },
    {
      level: 5,
      title: "LEVEL 5: 사자성어 마스터 도전",
      subtitle: "최고 난이도 성어와 종합 응용력을 겨루는 마스터 코스 105선",
      icon: "👑",
      passScore: 70
    }
  ];

  // 점수 구간별 칭호 부여 (프롬프트 기준 반영)
  function getTitleByScore(score) {
    if (score >= 91) return { icon: "👑", name: "사자성어 마스터", grade: "S등급", min: 91 };
    if (score >= 71) return { icon: "🔥", name: "사자성어 고수", grade: "A등급", min: 71 };
    if (score >= 51) return { icon: "⚔️", name: "사자성어 도전자", grade: "B등급", min: 51 };
    if (score >= 31) return { icon: "🧭", name: "사자성어 탐험가", grade: "C등급", min: 31 };
    return { icon: "🌱", name: "사자성어 새싹", grade: "D등급", min: 0 };
  }

  // ==========================================================================
  // 2. 상태 관리 및 LocalStorage 연동
  // ==========================================================================
  const STORAGE_KEY = "middle_idiom_master_save_v1";
  const PUBLIC_GAME_URL = "https://sangmin1254-boop.github.io/middle-school-idiom-master/";

  const state = {
    currentView: "start", // 'start' | 'play' | 'result'
    currentLevel: 1,
    unlockedLevel: 1,
    levelStars: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, // 각 레벨별 별 0~3개
    levelBestScores: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },

    totalScore: 0,
    bestSingleScore: 0,
    totalAnswered: 0,
    totalCorrect: 0,

    learnedIds: new Set(),
    wrongNotes: {}, // { [id]: { count: number, updatedAt: string } }
    soundEnabled: true,

    todayIdiom: null,

    // 현재 플레이 중인 STEP 세션
    session: {
      step: 1,            // 1 ~ 5
      isWrongRetry: false,
      items: [],          // STEP 1 학습용 아이템 배열 (10개)
      questions: [],      // STEP 2~5 문제 배열 (10개)
      currentIndex: 0,
      stepScore: 0,
      correctCount: 0,
      combo: 0,
      maxCombo: 0,
      answered: false,
      wrongIdsThisRound: [],
      // STEP 3 빈칸 타이머 상태
      timerId: null,
      timeLeft: 15.0,
      maxTime: 15.0
    },

    // 도감 모달 필터 상태
    collectionFilter: "all",
    collectionSearch: ""
  };

  function loadSaveData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.unlockedLevel) state.unlockedLevel = data.unlockedLevel;
      if (data.currentLevel) state.currentLevel = Math.min(data.currentLevel, state.unlockedLevel);
      if (data.levelStars) state.levelStars = { ...state.levelStars, ...data.levelStars };
      if (data.levelBestScores) state.levelBestScores = { ...state.levelBestScores, ...data.levelBestScores };
      if (typeof data.totalScore === "number") state.totalScore = data.totalScore;
      if (typeof data.bestSingleScore === "number") state.bestSingleScore = data.bestSingleScore;
      if (typeof data.totalAnswered === "number") state.totalAnswered = data.totalAnswered;
      if (typeof data.totalCorrect === "number") state.totalCorrect = data.totalCorrect;
      if (Array.isArray(data.learnedIds)) state.learnedIds = new Set(data.learnedIds);
      if (data.wrongNotes) state.wrongNotes = data.wrongNotes;
      if (typeof data.soundEnabled === "boolean") state.soundEnabled = data.soundEnabled;
    } catch (e) {
      console.warn("저장 데이터 로드 오류:", e);
    }
  }

  function saveGameData() {
    try {
      const payload = {
        unlockedLevel: state.unlockedLevel,
        currentLevel: state.currentLevel,
        levelStars: state.levelStars,
        levelBestScores: state.levelBestScores,
        totalScore: state.totalScore,
        bestSingleScore: state.bestSingleScore,
        totalAnswered: state.totalAnswered,
        totalCorrect: state.totalCorrect,
        learnedIds: [...state.learnedIds],
        wrongNotes: state.wrongNotes,
        soundEnabled: state.soundEnabled
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {}
    updateHUD();
  }

  // ==========================================================================
  // 3. Web Audio API 아케이드 효과음 엔진
  // ==========================================================================
  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  const Sound = {
    click() {
      if (!state.soundEnabled) return;
      const ctx = getAudioCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(760, now + 0.04);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    },
    correct(combo = 1) {
      if (!state.soundEnabled) return;
      const ctx = getAudioCtx();
      if (!ctx) return;
      const baseNotes = [523.25, 659.25, 783.99, 1046.5];
      const pitchShift = Math.min(1.25, 1 + (combo - 1) * 0.04);
      const now = ctx.currentTime;
      baseNotes.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + i * 0.07;
        osc.type = "triangle";
        osc.frequency.setValueAtTime(f * pitchShift, t);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.2, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.24);
      });
    },
    wrong() {
      if (!state.soundEnabled) return;
      const ctx = getAudioCtx();
      if (!ctx) return;
      const notes = [300, 235];
      const now = ctx.currentTime;
      notes.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + i * 0.14;
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(f, t);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.13, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.24);
      });
    },
    fanfare() {
      if (!state.soundEnabled) return;
      const ctx = getAudioCtx();
      if (!ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      const now = ctx.currentTime;
      notes.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + i * 0.1;
        const dur = i === notes.length - 1 ? 0.45 : 0.18;
        osc.type = "triangle";
        osc.frequency.setValueAtTime(f, t);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.22, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.02);
      });
    }
  };

  function speakIdiom(idiom) {
    if (!("speechSynthesis" in window)) {
      showToast("이 브라우저에서는 음성 읽기를 지원하지 않아요.");
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(`${idiom.word}. ${idiom.meaning}`);
    u.lang = "ko-KR";
    u.rate = 0.96;
    window.speechSynthesis.speak(u);
    showToast(`🔊 [${idiom.word}] 발음과 뜻을 읽어 드려요!`);
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  let toastTimeout = null;
  function showToast(msg) {
    const el = document.getElementById("toastMessage");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => el.classList.add("hidden"), 2500);
  }

  // ==========================================================================
  // 4. 상단 HUD 및 시작 화면 렌더링
  // ==========================================================================
  function updateHUD() {
    const titleObj = getTitleByScore(state.bestSingleScore);
    document.getElementById("hudRankBadge").textContent = `${titleObj.icon} ${titleObj.name}`;
    document.getElementById("hudLevelText").textContent = state.currentLevel;
    document.getElementById("hudScoreText").textContent = state.totalScore.toLocaleString();

    const totalStars = Object.values(state.levelStars).reduce((a, b) => a + b, 0);
    document.getElementById("hudStarsText").textContent = `${totalStars} / 15`;
    document.getElementById("hudLearnedCount").textContent = state.learnedIds.size;

    const wrongCount = Object.keys(state.wrongNotes).length;
    const startWrongEl = document.getElementById("startWrongCount");
    if (startWrongEl) startWrongEl.textContent = wrongCount;

    const soundBtn = document.getElementById("soundToggleBtn");
    const soundIcon = document.getElementById("soundIcon");
    if (soundBtn && soundIcon) {
      soundBtn.classList.toggle("active", state.soundEnabled);
      soundIcon.textContent = state.soundEnabled ? "🔊" : "🔇";
    }
  }

  function renderTodayIdiom() {
    const raw = IDIOMS_DATA[Math.floor(Math.random() * IDIOMS_DATA.length)];
    const enriched = getEnrichedIdiom(raw);
    state.todayIdiom = enriched;

    document.getElementById("todayHanja").textContent = enriched.hanja;
    document.getElementById("todayWord").textContent = enriched.word;
    document.getElementById("todayLevelTag").textContent = `LEVEL ${enriched.level}`;
    document.getElementById("todayMeaning").textContent = enriched.meaning;
    document.getElementById("todayExample").textContent = `💬 예문: ${enriched.exampleSentence}`;
  }

  function renderLevelSelectGrid() {
    const grid = document.getElementById("levelGrid");
    if (!grid) return;
    grid.innerHTML = "";

    LEVEL_CONFIGS.forEach((cfg) => {
      const isUnlocked = cfg.level <= state.unlockedLevel;
      const isCurrent = cfg.level === state.currentLevel;
      const stars = state.levelStars[cfg.level] || 0;
      const best = state.levelBestScores[cfg.level] || 0;
      const starStr = "⭐".repeat(stars) + "☆".repeat(3 - stars);

      const card = document.createElement("div");
      card.className = `level-card ${isUnlocked ? "unlocked" : "locked"} ${isCurrent ? "current-level" : ""}`;

      card.innerHTML = `
        <div>
          <div class="lv-top">
            <span class="lv-badge">${cfg.icon} LEVEL ${cfg.level}</span>
            <span class="lv-stars" title="획득한 별">${starStr}</span>
          </div>
          <h4 class="lv-title">${cfg.title.replace(/^LEVEL \d+:\s*/, "")}</h4>
          <p class="lv-desc">${cfg.subtitle}</p>
        </div>
        <div>
          <p class="lv-count-tag">최고 기록: ${best}점 (통과 기준: ${cfg.passScore}점)</p>
          <button type="button" class="lv-play-btn" ${!isUnlocked ? "disabled" : ""}>
            ${isUnlocked ? (isCurrent ? "🚀 이 레벨 플레이" : "⚡ 선택하고 시작") : "🔒 이전 레벨 통과 시 열림"}
          </button>
        </div>
      `;

      if (isUnlocked) {
        card.querySelector(".lv-play-btn").addEventListener("click", () => {
          Sound.click();
          state.currentLevel = cfg.level;
          saveGameData();
          enterLevelPlay(cfg.level, 1);
        });
      }

      grid.appendChild(card);
    });
  }

  // ==========================================================================
  // 5. 뷰 전환 및 STEP 1 ~ STEP 5 진입 엔진
  // ==========================================================================
  function switchView(viewName) {
    stopBlankTimer();
    state.currentView = viewName;
    document.querySelectorAll(".game-view").forEach((v) => {
      v.classList.toggle("active", v.id === `view-${viewName}`);
    });
    if (viewName === "start") {
      renderLevelSelectGrid();
      updateHUD();
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function getLevelPool(level) {
    const pool = IDIOMS_DATA.filter((it) => it.level === level);
    return pool.length > 0 ? pool : IDIOMS_DATA;
  }

  function enterLevelPlay(level, step = 1, isWrongRetry = false) {
    stopBlankTimer();
    state.currentLevel = level;
    const cfg = LEVEL_CONFIGS.find((c) => c.level === level) || LEVEL_CONFIGS[0];

    document.getElementById("playLevelBanner").textContent = isWrongRetry
      ? "📝 틀린 문제 집중 복습 모드"
      : `${cfg.icon} ${cfg.title}`;

    switchView("play");
    startStep(step, isWrongRetry);
  }

  function startStep(stepNum, isWrongRetry = false) {
    stopBlankTimer();

    // 탭 활성화 표시
    document.querySelectorAll("#stepTabs .step-tab").forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.step) === stepNum);
    });

    // 서브 뷰 전환
    document.getElementById("step-view-1").classList.toggle("hidden", stepNum !== 1);
    document.getElementById("step-view-blank").classList.toggle("hidden", stepNum !== 3);
    document.getElementById("step-view-quiz").classList.toggle("hidden", stepNum === 1 || stepNum === 3);

    // 출제 풀 준비
    let pool = [];
    if (isWrongRetry) {
      const wrongIds = Object.keys(state.wrongNotes).map(Number);
      pool = IDIOMS_DATA.filter((it) => wrongIds.includes(it.id));
      if (pool.length === 0) {
        showToast("🎉 틀린 문제가 없습니다! 일반 레벨 퀴즈로 시작합니다.");
        isWrongRetry = false;
        pool = getLevelPool(state.currentLevel);
      }
    } else if (stepNum === 5) {
      // STEP 5 최종 도전 퀴즈: 현재 레벨 70% + 다른 난이도 30% 혼합하여 난이도별 10문제 출제
      const lvPool = shuffle(getLevelPool(state.currentLevel));
      const otherPool = shuffle(IDIOMS_DATA.filter((it) => it.level <= state.currentLevel));
      pool = [...lvPool.slice(0, 7), ...otherPool.slice(0, 10)];
    } else {
      pool = getLevelPool(state.currentLevel);
    }

    const picked = shuffle(pool).slice(0, 10).map((it) => getEnrichedIdiom(it));

    state.session = {
      step: stepNum,
      isWrongRetry,
      items: picked,
      questions: [],
      currentIndex: 0,
      stepScore: 0,
      correctCount: 0,
      combo: 0,
      maxCombo: 0,
      answered: false,
      wrongIdsThisRound: [],
      timerId: null,
      timeLeft: 15.0,
      maxTime: 15.0
    };

    if (stepNum === 1) {
      renderStudyStepCard();
    } else if (stepNum === 3) {
      state.session.questions = buildBlankQuestions(picked);
      renderBlankQuestion();
    } else {
      state.session.questions = buildMultipleChoiceQuestions(picked, stepNum);
      renderQuizQuestion();
    }
  }

  function updateStepProgressUI() {
    const s = state.session;
    const total = s.step === 1 ? s.items.length : s.questions.length;
    const current = s.currentIndex + 1;
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;

    const stepNames = {
      1: "STEP 1 · 사자성어 학습하기",
      2: "STEP 2 · 객관식 퀴즈",
      3: "STEP 3 · 한자 빈칸 타임어택",
      4: "STEP 4 · 상황별 사자성어 찾기",
      5: "STEP 5 · 최종 마스터 도전 퀴즈"
    };

    document.getElementById("progressStepLabel").textContent =
      `${stepNames[s.step]} (${current} / ${total})`;
    document.getElementById("stepScoreText").textContent = s.stepScore;
    document.getElementById("stepProgressBar").style.width = `${pct}%`;

    const comboBadge = document.getElementById("comboBadge");
    if (s.combo >= 2) {
      comboBadge.textContent = `🔥 ${s.combo}연속 정답! (+${Math.min(10, s.combo * 2)}점 보너스)`;
      comboBadge.classList.remove("hidden");
    } else {
      comboBadge.classList.add("hidden");
    }
  }

  // ==========================================================================
  // 6. STEP 1: 사자성어 학습하기 (한자별 훈음 분해 + 쉬운 설명 + 예문 + 유래)
  // ==========================================================================
  function renderStudyStepCard() {
    updateStepProgressUI();
    const s = state.session;
    const item = s.items[s.currentIndex];
    if (!item) return;

    // 학습 카드를 본 사자성어는 자동으로 학습 완료 도감에 등록
    state.learnedIds.add(item.id);
    saveGameData();

    document.getElementById("studyCategoryChip").textContent = `LEVEL ${item.level} · ${item.category}`;
    document.getElementById("studyWord").textContent = item.word;
    document.getElementById("studyHanja").textContent = item.hanja;

    // 한자 4글자 분해 카드
    const grid = document.getElementById("studyBreakdownGrid");
    grid.innerHTML = "";
    item.breakdown.forEach((b) => {
      const box = document.createElement("div");
      box.className = "hanja-char-card";
      box.innerHTML = `
        <span class="hc-char">${b.hanja}</span>
        <span class="hc-hun-sound">${b.hun} <strong>${b.sound}</strong></span>
      `;
      grid.appendChild(box);
    });

    document.getElementById("studyMeaning").textContent = item.meaning;
    document.getElementById("studyEasyExp").textContent = item.easyExplanation;
    document.getElementById("studyExample").textContent = item.exampleSentence;
    document.getElementById("studyStory").textContent = item.originStory;

    const bookmarkBtn = document.getElementById("studyBookmarkBtn");
    bookmarkBtn.classList.toggle("active", state.learnedIds.has(item.id));
    bookmarkBtn.textContent = "⭐ 학습 완료됨";

    const prevBtn = document.getElementById("prevStudyCardBtn");
    prevBtn.disabled = s.currentIndex === 0;

    const nextBtn = document.getElementById("nextStudyCardBtn");
    nextBtn.textContent =
      s.currentIndex + 1 >= s.items.length
        ? "🎯 STEP 2 객관식 퀴즈로 이동 ➡️"
        : "다음 사자성어 ➡️";
  }

  // ==========================================================================
  // 7. STEP 2, 4, 5: 객관식 퀴즈 / 상황별 사자성어 찾기 / 최종 도전 퀴즈
  // ==========================================================================
  function buildMultipleChoiceQuestions(items, stepNum) {
    return items.map((target, idx) => {
      let qMode = "word_to_meaning";
      if (stepNum === 2) {
        // STEP 2: 뜻 묻기, 사자성어 맞히기, 상황 맞히기 골고루 출제
        const modes = ["word_to_meaning", "meaning_to_word", "situation_to_word"];
        qMode = modes[idx % 3];
      } else if (stepNum === 4) {
        // STEP 4: 100% 일상·학교생활 상황별 사자성어 찾기
        qMode = "situation_to_word";
      } else if (stepNum === 5) {
        // STEP 5: 최종 도전 10문항 (난이도별 종합 출제)
        const modes = ["word_to_meaning", "meaning_to_word", "situation_to_word", "example_blank"];
        qMode = modes[idx % 4];
      }

      const distractors = shuffle(
        IDIOMS_DATA.filter((it) => it.id !== target.id)
      ).slice(0, 3).map((it) => getEnrichedIdiom(it));

      const choices = shuffle([target, ...distractors]);

      return {
        target,
        qMode,
        choices
      };
    });
  }

  function renderQuizQuestion() {
    updateStepProgressUI();
    const s = state.session;
    const q = s.questions[s.currentIndex];
    if (!q) return;

    s.answered = false;
    const t = q.target;

    const typeChip = document.getElementById("qTypeChip");
    const instruction = document.getElementById("qInstruction");
    const mainPrompt = document.getElementById("qMainPrompt");
    const subPrompt = document.getElementById("qSubPrompt");
    const charHint = document.getElementById("qCharHint");

    const breakdownText = t.breakdown.map((b) => `${b.hanja}(${b.hun} ${b.sound})`).join(" · ");

    if (q.qMode === "word_to_meaning") {
      typeChip.textContent = "📜 사자성어 뜻 맞히기";
      instruction.textContent = "다음 사자성어의 알맞은 뜻은 무엇일까요?";
      mainPrompt.className = "q-main-prompt";
      mainPrompt.textContent = `${t.word} (${t.hanja})`;
      subPrompt.textContent = `분류: ${t.category}`;
      charHint.textContent = `💡 한자 풀이: ${breakdownText}`;
    } else if (q.qMode === "meaning_to_word") {
      typeChip.textContent = "💡 뜻 보고 사자성어 맞히기";
      instruction.textContent = "다음 뜻풀이에 해당하는 알맞은 사자성어를 고르세요!";
      mainPrompt.className = "q-main-prompt text-prompt";
      mainPrompt.textContent = `“${t.meaning}”`;
      subPrompt.textContent = `힌트 분류: ${t.category}`;
      charHint.textContent = `💡 첫 글자 힌트: '${t.breakdown[0].hun} ${t.breakdown[0].sound}(${t.breakdown[0].hanja})'(으)로 시작해요.`;
    } else if (q.qMode === "situation_to_word") {
      typeChip.textContent = "🏫 상황별 사자성어 찾기";
      instruction.textContent = "다음 일상·학교생활 상황에 가장 어울리는 사자성어는 무엇일까요?";
      mainPrompt.className = "q-main-prompt text-prompt";
      mainPrompt.textContent = `“${t.situationPrompt}”`;
      subPrompt.textContent = `상황 주제: ${t.category}`;
      charHint.textContent = `💡 상황에 담긴 핵심 의미: ${t.meaning}`;
    } else {
      // example_blank (예문 빈칸 추론)
      typeChip.textContent = "👑 실전 예문 빈칸 완성";
      instruction.textContent = "다음 문장의 빈칸 ( ㉠ )에 들어갈 가장 적절한 사자성어는?";
      const maskedExample = t.exampleSentence
        .replace(new RegExp(`${t.word}\\(${t.hanja}\\)`, "g"), "( ㉠ )")
        .replace(new RegExp(t.word, "g"), "( ㉠ )");
      mainPrompt.className = "q-main-prompt text-prompt";
      mainPrompt.textContent = `“${maskedExample}”`;
      subPrompt.textContent = `문맥 힌트: ${t.meaning}`;
      charHint.textContent = "";
    }

    const choicesGrid = document.getElementById("quizChoicesGrid");
    choicesGrid.innerHTML = "";

    const circleNums = ["①", "②", "③", "④"];
    q.choices.forEach((ch, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quiz-choice-btn";
      btn.dataset.id = ch.id;

      const labelHtml =
        q.qMode === "word_to_meaning"
          ? `<span>${ch.meaning}</span>`
          : `<span><strong>${ch.word}</strong> (${ch.hanja})</span>`;

      btn.innerHTML = `
        <span class="choice-index">${circleNums[idx] || idx + 1}</span>
        ${labelHtml}
      `;

      btn.addEventListener("click", () => handleQuizChoice(ch));
      choicesGrid.appendChild(btn);
    });

    document.getElementById("quizFeedbackBox").classList.add("hidden");
  }

  function handleQuizChoice(selected) {
    const s = state.session;
    if (s.answered) return;
    s.answered = true;

    const q = s.questions[s.currentIndex];
    const target = q.target;
    const isCorrect = selected.id === target.id;

    state.totalAnswered += 1;
    state.learnedIds.add(target.id);

    const buttons = document.querySelectorAll("#quizChoicesGrid .quiz-choice-btn");
    buttons.forEach((btn) => {
      btn.disabled = true;
      const cid = Number(btn.dataset.id);
      if (cid === target.id) btn.classList.add("correct");
      else if (cid === selected.id && !isCorrect) btn.classList.add("wrong");
    });

    let earnedPoints = 0;
    let comboBonus = 0;

    if (isCorrect) {
      state.totalCorrect += 1;
      s.correctCount += 1;
      s.combo += 1;
      if (s.combo > s.maxCombo) s.maxCombo = s.combo;

      comboBonus = s.combo >= 2 ? Math.min(10, (s.combo - 1) * 2) : 0;
      earnedPoints = 10 + comboBonus;
      s.stepScore += earnedPoints;
      state.totalScore += earnedPoints;

      // 오답 복습 모드에서 맞히면 오답노트에서 졸업
      if (s.isWrongRetry && state.wrongNotes[target.id]) {
        delete state.wrongNotes[target.id];
      }

      Sound.correct(s.combo);
    } else {
      s.combo = 0;
      if (!s.wrongIdsThisRound.includes(target.id)) {
        s.wrongIdsThisRound.push(target.id);
      }
      const prev = state.wrongNotes[target.id]?.count || 0;
      state.wrongNotes[target.id] = {
        count: prev + 1,
        updatedAt: new Date().toLocaleDateString("ko-KR")
      };
      Sound.wrong();
    }

    saveGameData();
    updateStepProgressUI();

    // 피드백 박스 표시
    const fbBox = document.getElementById("quizFeedbackBox");
    const fbHeader = document.getElementById("fbHeader");
    const fbEmoji = document.getElementById("fbEmoji");
    const fbTitle = document.getElementById("fbTitle");
    const fbSub = document.getElementById("fbSub");

    const praiseMessages = [
      "정답입니다! 어휘력 센스가 정말 대단해요!",
      "완벽해요! 사자성어의 핵심을 정확히 꿰뚫었네요!",
      "최고예요! 사자성어 마스터에 한 걸음 더 가까워졌어요!"
    ];

    if (isCorrect) {
      fbHeader.className = "fb-header is-correct";
      fbEmoji.textContent = "🎉";
      const praise = praiseMessages[s.currentIndex % praiseMessages.length];
      fbTitle.textContent = `${praise} (+${earnedPoints}점)`;
      fbSub.textContent =
        comboBonus > 0
          ? `🔥 ${s.combo}연속 정답 콤보 보너스 +${comboBonus}점이 추가되었어요!`
          : "기본 정답 점수 +10점을 획득했어요!";
    } else {
      fbHeader.className = "fb-header is-wrong";
      fbEmoji.textContent = "💡";
      fbTitle.textContent = `아쉬워요! 정답은 [${target.word}(${target.hanja})]입니다.`;
      fbSub.textContent = `내가 고른 [${selected.word}]은(는) “${selected.meaning}”라는 뜻이에요.`;
    }

    document.getElementById("fbWord").textContent = `${target.word} (${target.hanja})`;
    document.getElementById("fbBreakdown").textContent =
      target.breakdown.map((b) => `${b.hanja}(${b.hun} ${b.sound})`).join(" · ");
    document.getElementById("fbMeaning").textContent = `📌 뜻: ${target.meaning}`;
    document.getElementById("fbReason").textContent =
      q.qMode === "situation_to_word"
        ? `✅ 상황에 알맞은 이유: "${target.situationPrompt}" 상황은 '${target.meaning}'을(를) 뜻하는 [${target.word}]와(과) 정확히 일치하기 때문이에요!`
        : `🦊 쉬운 해설: ${target.easyExplanation}`;
    document.getElementById("fbExample").textContent = `💬 활용 예문: ${target.exampleSentence}`;

    const isLast = s.currentIndex + 1 >= s.questions.length;
    const nextLabel = isLast ? "🏁 결과 및 점수 확인하기 ➡️" : "다음 문제로 넘어가기 ➡️";
    document.getElementById("fbNextTopBtn").textContent = isLast ? "🏁 결과 보기 ➡️" : "다음 문제 ➡️";
    document.getElementById("fbNextBottomBtn").textContent = nextLabel;

    fbBox.classList.remove("hidden");
    setTimeout(() => {
      fbBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  }

  // ==========================================================================
  // 8. STEP 3: 한자 빈칸 채우기 타임어택 게임
  // ==========================================================================
  function buildBlankQuestions(items) {
    const allChars = Object.keys(HANJA_HUN_MAP);
    return items.map((target) => {
      const blankIdx = Math.floor(Math.random() * 4);
      const answerCharObj = target.breakdown[blankIdx];

      // 오답 한자 3개 추출
      const distractorChars = [];
      while (distractorChars.length < 3) {
        const randH = allChars[Math.floor(Math.random() * allChars.length)];
        if (randH !== answerCharObj.hanja && !distractorChars.some((d) => d.hanja === randH)) {
          distractorChars.push({
            hanja: randH,
            hun: HANJA_HUN_MAP[randH] || "뜻"
          });
        }
      }

      const options = shuffle([
        { hanja: answerCharObj.hanja, hun: answerCharObj.hun, isAnswer: true },
        ...distractorChars.map((d) => ({ ...d, isAnswer: false }))
      ]);

      return {
        target,
        blankIdx,
        answerCharObj,
        options
      };
    });
  }

  function stopBlankTimer() {
    if (state.session.timerId) {
      clearInterval(state.session.timerId);
      state.session.timerId = null;
    }
  }

  function startBlankTimer() {
    stopBlankTimer();
    const s = state.session;
    s.timeLeft = s.maxTime;
    updateBlankTimerUI();

    s.timerId = setInterval(() => {
      if (s.answered) {
        stopBlankTimer();
        return;
      }
      s.timeLeft = Math.max(0, +(s.timeLeft - 0.1).toFixed(1));
      updateBlankTimerUI();

      if (s.timeLeft <= 0) {
        stopBlankTimer();
        handleBlankOptionSelect(null, true); // 시간 초과
      }
    }, 100);
  }

  function updateBlankTimerUI() {
    const s = state.session;
    const textEl = document.getElementById("blankTimerText");
    const barEl = document.getElementById("blankTimerBar");
    if (textEl) textEl.textContent = `${s.timeLeft.toFixed(1)}초`;
    if (barEl) {
      const pct = Math.max(0, (s.timeLeft / s.maxTime) * 100);
      barEl.style.width = `${pct}%`;
    }
  }

  function renderBlankQuestion() {
    updateStepProgressUI();
    const s = state.session;
    const q = s.questions[s.currentIndex];
    if (!q) return;

    s.answered = false;
    const t = q.target;

    document.getElementById("blankMeaningText").textContent = `“${t.meaning}”`;

    // 4개 슬롯 렌더링
    const slotsRow = document.getElementById("blankSlotsRow");
    slotsRow.innerHTML = "";
    t.breakdown.forEach((b, idx) => {
      const slot = document.createElement("div");
      const isBlank = idx === q.blankIdx;
      slot.className = `blank-slot ${isBlank ? "target-blank" : ""}`;
      slot.id = isBlank ? "activeBlankSlot" : "";
      slot.innerHTML = `
        <span class="slot-hanja">${isBlank ? "?" : b.hanja}</span>
        <span class="slot-sound">${b.hun} <strong>${b.sound}</strong></span>
      `;
      slotsRow.appendChild(slot);
    });

    // 4개 한자 보기 렌더링
    const optsGrid = document.getElementById("blankOptionsGrid");
    optsGrid.innerHTML = "";
    q.options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "blank-opt-btn";
      btn.dataset.hanja = opt.hanja;
      btn.innerHTML = `
        <span class="bo-hanja">${opt.hanja}</span>
        <span class="bo-hun">뜻: ${opt.hun}</span>
      `;
      btn.addEventListener("click", () => handleBlankOptionSelect(opt, false));
      optsGrid.appendChild(btn);
    });

    document.getElementById("blankFeedbackBox").classList.add("hidden");
    startBlankTimer();
  }

  function handleBlankOptionSelect(selectedOpt, isTimeout = false) {
    const s = state.session;
    if (s.answered) return;
    s.answered = true;
    stopBlankTimer();

    const q = s.questions[s.currentIndex];
    const target = q.target;
    const isCorrect = !isTimeout && selectedOpt && selectedOpt.isAnswer;

    state.totalAnswered += 1;
    state.learnedIds.add(target.id);

    // 슬롯에 정답 한자 채워 넣기
    const activeSlot = document.getElementById("activeBlankSlot");
    if (activeSlot) {
      activeSlot.querySelector(".slot-hanja").textContent = q.answerCharObj.hanja;
      activeSlot.classList.add(isCorrect ? "filled-correct" : "filled-wrong");
    }

    document.querySelectorAll("#blankOptionsGrid .blank-opt-btn").forEach((btn) => {
      btn.disabled = true;
      if (btn.dataset.hanja === q.answerCharObj.hanja) {
        btn.classList.add("correct");
      } else if (selectedOpt && btn.dataset.hanja === selectedOpt.hanja && !isCorrect) {
        btn.classList.add("wrong");
      }
    });

    let earned = 0;
    let timeBonus = 0;
    let comboBonus = 0;

    if (isCorrect) {
      state.totalCorrect += 1;
      s.correctCount += 1;
      s.combo += 1;
      if (s.combo > s.maxCombo) s.maxCombo = s.combo;

      timeBonus = Math.ceil((s.timeLeft / s.maxTime) * 5); // 제한시간 스피드 보너스 1~5점
      comboBonus = s.combo >= 2 ? Math.min(10, (s.combo - 1) * 2) : 0;
      earned = 10 + timeBonus + comboBonus;
      s.stepScore += earned;
      state.totalScore += earned;

      Sound.correct(s.combo);
    } else {
      s.combo = 0;
      if (!s.wrongIdsThisRound.includes(target.id)) {
        s.wrongIdsThisRound.push(target.id);
      }
      const prev = state.wrongNotes[target.id]?.count || 0;
      state.wrongNotes[target.id] = {
        count: prev + 1,
        updatedAt: new Date().toLocaleDateString("ko-KR")
      };
      Sound.wrong();
    }

    saveGameData();
    updateStepProgressUI();

    const fbBox = document.getElementById("blankFeedbackBox");
    const fbHeader = document.getElementById("blankFbHeader");
    const fbEmoji = document.getElementById("blankFbEmoji");
    const fbTitle = document.getElementById("blankFbTitle");
    const fbSub = document.getElementById("blankFbSub");

    if (isCorrect) {
      fbHeader.className = "fb-header is-correct";
      fbEmoji.textContent = "⚡";
      fbTitle.textContent = `정답입니다! [${q.answerCharObj.hanja}(${q.answerCharObj.hun} ${q.answerCharObj.sound})] (+${earned}점)`;
      fbSub.textContent = `기본 10점 + 스피드 보너스 +${timeBonus}점${comboBonus > 0 ? ` + 콤보 보너스 +${comboBonus}점` : ""} 획득!`;
    } else {
      fbHeader.className = "fb-header is-wrong";
      fbEmoji.textContent = isTimeout ? "⏰" : "💡";
      fbTitle.textContent = isTimeout
        ? `시간 초과! 빈칸의 정답은 [${q.answerCharObj.hanja}(${q.answerCharObj.hun} ${q.answerCharObj.sound})]입니다.`
        : `아쉬워요! 빈칸의 정답은 [${q.answerCharObj.hanja}(${q.answerCharObj.hun} ${q.answerCharObj.sound})]입니다.`;
      fbSub.textContent = `완성된 사자성어: ${target.word} (${target.hanja})`;
    }

    document.getElementById("blankFbWord").textContent = `${target.word} (${target.hanja})`;
    document.getElementById("blankFbBreakdown").textContent =
      target.breakdown.map((b) => `${b.hanja}(${b.hun} ${b.sound})`).join(" · ");
    document.getElementById("blankFbMeaning").textContent = `📌 뜻: ${target.meaning}`;
    document.getElementById("blankFbExample").textContent = `💬 예문: ${target.exampleSentence}`;

    const isLast = s.currentIndex + 1 >= s.questions.length;
    document.getElementById("blankNextTopBtn").textContent = isLast ? "🏁 결과 보기 ➡️" : "다음 문제 ➡️";
    document.getElementById("blankNextBottomBtn").textContent = isLast ? "🏁 빈칸 게임 결과 확인 ➡️" : "다음 빈칸 문제로 ➡️";

    fbBox.classList.remove("hidden");
    setTimeout(() => {
      fbBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  }

  // ==========================================================================
  // 9. 다음 문제 이동 및 단계 완료 결과 화면 (레벨 통과·별·칭호 판정)
  // ==========================================================================
  function advanceQuestion() {
    Sound.click();
    const s = state.session;
    if (s.currentIndex + 1 < s.questions.length) {
      s.currentIndex += 1;
      if (s.step === 3) renderBlankQuestion();
      else renderQuizQuestion();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      showStepResultScreen();
    }
  }

  function showStepResultScreen() {
    stopBlankTimer();
    Sound.fanfare();

    const s = state.session;
    const total = s.questions.length;
    const correct = s.correctCount;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const rawHundredScore = accuracy; // 10문제 기준 100점 환산 점수
    const totalEarnedScore = s.stepScore;

    if (totalEarnedScore > state.bestSingleScore) {
      state.bestSingleScore = totalEarnedScore;
    }
    if (totalEarnedScore > (state.levelBestScores[state.currentLevel] || 0)) {
      state.levelBestScores[state.currentLevel] = totalEarnedScore;
    }

    // 별 개수 계산 (90% 이상 별 3개, 70% 이상 별 2개, 60% 이상 별 1개)
    let earnedStars = 0;
    if (accuracy >= 90) earnedStars = 3;
    else if (accuracy >= 70) earnedStars = 2;
    else if (accuracy >= 60) earnedStars = 1;

    if (earnedStars > (state.levelStars[state.currentLevel] || 0)) {
      state.levelStars[state.currentLevel] = earnedStars;
    }

    // 레벨 통과 및 다음 레벨 오픈 판정 (60% 이상이거나 STEP 5에서 기준 점수 이상)
    const cfg = LEVEL_CONFIGS.find((c) => c.level === state.currentLevel) || LEVEL_CONFIGS[0];
    const passed = accuracy >= 60 || totalEarnedScore >= cfg.passScore;
    let newlyUnlocked = false;

    if (passed && state.currentLevel === state.unlockedLevel && state.unlockedLevel < 5) {
      state.unlockedLevel += 1;
      newlyUnlocked = true;
    }

    saveGameData();
    switchView("result");

    const titleInfo = getTitleByScore(Math.max(rawHundredScore, Math.min(100, totalEarnedScore)));

    document.getElementById("resTrophyIcon").textContent = passed ? "🏆" : "💪";
    document.getElementById("resStepBadge").textContent = s.isWrongRetry
      ? "📝 틀린 문제 복습 퀴즈 완료!"
      : `LEVEL ${state.currentLevel} · STEP ${s.step} 완료!`;

    if (newlyUnlocked) {
      document.getElementById("resHeading").textContent =
        `🎉 축하합니다! LEVEL ${state.currentLevel} 통과! LEVEL ${state.unlockedLevel}이 열렸습니다!`;
    } else if (passed) {
      document.getElementById("resHeading").textContent =
        `훌륭해요! ${titleInfo.icon} [${titleInfo.name}] 실력을 증명했어요!`;
    } else {
      document.getElementById("resHeading").textContent =
        "아깝게 통과 점수에 못 미쳤어요! 다시 한번 도전해 볼까요?";
    }

    document.getElementById("resDesc").textContent =
      `총 ${total}문제 중 ${correct}문제를 맞혀 총점 ${totalEarnedScore}점(보너스 포함)을 획득했습니다!`;

    // 별 렌더링
    const starsRow = document.getElementById("resStarsRow");
    starsRow.innerHTML = "";
    for (let i = 1; i <= 3; i++) {
      const span = document.createElement("span");
      span.className = `res-star ${i <= earnedStars ? "earned" : "empty"}`;
      span.textContent = "⭐";
      starsRow.appendChild(span);
    }

    document.getElementById("resTitleName").textContent = `${titleInfo.icon} ${titleInfo.name}`;
    document.getElementById("resGradeText").textContent = titleInfo.grade;

    document.getElementById("resCorrectText").textContent = `${correct} / ${total}`;
    document.getElementById("resAccuracyText").textContent = `${accuracy}%`;
    document.getElementById("resMaxComboText").textContent = `${s.maxCombo}연속`;
    document.getElementById("resTotalScoreText").textContent = `${totalEarnedScore}점`;

    // 다음 단계 버튼 설정
    const nextActionBtn = document.getElementById("resNextActionBtn");
    if (s.step < 5) {
      nextActionBtn.textContent = `🚀 STEP ${s.step + 1} 단계로 이어서 진행 ➡️`;
      nextActionBtn.onclick = () => {
        Sound.click();
        enterLevelPlay(state.currentLevel, s.step + 1, false);
      };
    } else if (state.currentLevel < state.unlockedLevel) {
      nextActionBtn.textContent = `🚀 다음 LEVEL ${state.currentLevel + 1} 도전하기 ➡️`;
      nextActionBtn.onclick = () => {
        Sound.click();
        enterLevelPlay(state.currentLevel + 1, 1, false);
      };
    } else {
      nextActionBtn.textContent = "👑 최종 도전 퀴즈 한 번 더 플레이";
      nextActionBtn.onclick = () => {
        Sound.click();
        enterLevelPlay(state.currentLevel, 5, false);
      };
    }

    // 틀린 문제 다시 풀기 버튼 표시 여부
    const reviewWrongBtn = document.getElementById("resReviewWrongBtn");
    const wrongCount = Object.keys(state.wrongNotes).length;
    if (wrongCount > 0) {
      reviewWrongBtn.classList.remove("hidden");
      reviewWrongBtn.textContent = `📝 틀린 문제 다시 풀기 (${wrongCount}문제)`;
    } else {
      reviewWrongBtn.classList.add("hidden");
    }
  }

  // ==========================================================================
  // 10. 모달 1: 525선 사자성어 도감 & 학습한 단어 & 오답노트
  // ==========================================================================
  function openCollectionModal(defaultFilter = "all") {
    state.collectionFilter = defaultFilter;
    document.querySelectorAll("#collectionFilterTabs .m-tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.filter === defaultFilter);
    });
    document.getElementById("modal-collection").classList.remove("hidden");
    renderCollectionList();
  }

  function renderCollectionList() {
    const grid = document.getElementById("collectionListGrid");
    const query = state.collectionSearch.trim().toLowerCase();
    const filter = state.collectionFilter;

    const wrongIds = Object.keys(state.wrongNotes).map(Number);
    const startWrongQuizBtn = document.getElementById("startWrongQuizFromModalBtn");
    if (startWrongQuizBtn) {
      startWrongQuizBtn.classList.toggle("hidden", wrongIds.length === 0);
    }

    const filtered = IDIOMS_DATA.filter((it) => {
      if (filter === "learned" && !state.learnedIds.has(it.id)) return false;
      if (filter === "wrong" && !state.wrongNotes[it.id]) return false;
      if (filter.startsWith("lv")) {
        const lv = Number(filter.replace("lv", ""));
        if (it.level !== lv) return false;
      }
      if (query) {
        return (
          it.word.toLowerCase().includes(query) ||
          it.hanja.toLowerCase().includes(query) ||
          it.meaning.toLowerCase().includes(query) ||
          it.category.toLowerCase().includes(query)
        );
      }
      return true;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `<p style="grid-column: 1/-1; text-align:center; padding: 2rem; font-weight:700; color:#64748b;">조건에 맞는 사자성어가 없어요.</p>`;
      return;
    }

    const frag = document.createDocumentFragment();
    filtered.forEach((it) => {
      const isLearned = state.learnedIds.has(it.id);
      const isWrong = Boolean(state.wrongNotes[it.id]);

      const card = document.createElement("div");
      card.className = `col-card ${isLearned ? "is-learned" : ""} ${isWrong ? "is-wrong" : ""}`;
      card.innerHTML = `
        <div>
          <div class="col-top">
            <span>LEVEL ${it.level} · #${it.id}</span>
            <span>${isWrong ? `❗오답 ${state.wrongNotes[it.id].count}회` : isLearned ? "⭐학습완료" : it.category}</span>
          </div>
          <div class="col-word-line">
            <strong class="col-word">${it.word}</strong>
            <span class="col-hanja">${it.hanja}</span>
          </div>
          <p class="col-meaning">${it.meaning}</p>
        </div>
        <div style="display:flex; gap:0.35rem; margin-top:0.35rem;">
          <button type="button" class="mini-action-btn col-detail-btn" style="flex:1;">📖 상세 풀이·유래</button>
          <button type="button" class="mini-action-btn col-speak-btn">🔊</button>
        </div>
      `;

      card.querySelector(".col-detail-btn").addEventListener("click", () => {
        Sound.click();
        openHintModalForIdiom(getEnrichedIdiom(it));
      });
      card.querySelector(".col-speak-btn").addEventListener("click", () => {
        speakIdiom(it);
      });

      frag.appendChild(card);
    });

    grid.innerHTML = "";
    grid.appendChild(frag);
  }

  // ==========================================================================
  // 11. 모달 2: 나의 학습 결과 & 칭호 리포트
  // ==========================================================================
  function openStatsModal() {
    const titleObj = getTitleByScore(state.bestSingleScore);
    document.getElementById("statsRankIcon").textContent = titleObj.icon;
    document.getElementById("statsRankTitle").textContent = titleObj.name;
    document.getElementById("statsRankDesc").textContent =
      `최고 도전 점수 ${state.bestSingleScore}점으로 [${titleObj.grade}] 칭호를 보유 중입니다!`;

    document.getElementById("stTotalScore").textContent = `${state.totalScore.toLocaleString()}점`;
    document.getElementById("stBestScore").textContent = `${state.bestSingleScore}점`;
    const acc = state.totalAnswered > 0 ? Math.round((state.totalCorrect / state.totalAnswered) * 100) : 0;
    document.getElementById("stAccuracy").textContent = `${acc}% (${state.totalCorrect}/${state.totalAnswered})`;
    document.getElementById("stLearnedCount").textContent = `${state.learnedIds.size} / ${IDIOMS_DATA.length}개`;

    document.getElementById("modal-stats").classList.remove("hidden");
  }

  // ==========================================================================
  // 12. 모달 3: 게임 중 언제든지 뜻과 해설을 확인하는 [뜻·해설 찬스 모달]
  // ==========================================================================
  function openHintModalForIdiom(enriched) {
    if (!enriched) return;
    const body = document.getElementById("hintModalBody");

    const charBoxesHtml = enriched.breakdown
      .map(
        (b) => `
        <div class="hanja-char-card">
          <span class="hc-char">${b.hanja}</span>
          <span class="hc-hun-sound">${b.hun} <strong>${b.sound}</strong></span>
        </div>`
      )
      .join("");

    body.innerHTML = `
      <div style="text-align:center; margin-bottom:0.85rem;">
        <span class="chip-badge primary">LEVEL ${enriched.level} · ${enriched.category}</span>
        <h3 style="font-size:1.75rem; font-weight:900; margin-top:0.35rem;">${enriched.word} <span style="font-family:'Noto Serif KR',serif; color:#4f46e5;">(${enriched.hanja})</span></h3>
      </div>
      <div class="hanja-breakdown-grid" style="margin-bottom:0.9rem;">
        ${charBoxesHtml}
      </div>
      <div style="display:flex; flex-direction:column; gap:0.65rem;">
        <div class="study-info-box primary-box">
          <div class="info-label">📌 전체 사자성어 의미</div>
          <p class="info-text strong-text">${enriched.meaning}</p>
        </div>
        <div class="study-info-box easy-box">
          <div class="info-label">🦊 쉬운 중학생 설명</div>
          <p class="info-text">${enriched.easyExplanation}</p>
        </div>
        <div class="study-info-box example-box">
          <div class="info-label">💬 일상·학교생활 예문</div>
          <p class="info-text">${enriched.exampleSentence}</p>
        </div>
        <div class="study-info-box story-box">
          <div class="info-label">📜 유래 및 이야기</div>
          <p class="info-text">${enriched.originStory}</p>
        </div>
      </div>
    `;

    document.getElementById("modal-hint").classList.remove("hidden");
  }

  function openCurrentQuestionHintModal() {
    const s = state.session;
    let target = null;
    if (s.step === 1) {
      target = s.items[s.currentIndex];
    } else {
      target = s.questions[s.currentIndex]?.target;
    }
    if (target) {
      openHintModalForIdiom(target);
    }
  }

  // ==========================================================================
  // 13. 이벤트 바인딩 및 초기화
  // ==========================================================================
  function bindEvents() {
    // 상단 HUD 홈 버튼
    document.getElementById("hudHomeBtn").addEventListener("click", () => {
      Sound.click();
      switchView("start");
    });

    // 사운드 토글
    document.getElementById("soundToggleBtn").addEventListener("click", () => {
      state.soundEnabled = !state.soundEnabled;
      saveGameData();
      if (state.soundEnabled) Sound.click();
      showToast(state.soundEnabled ? "🔊 게임 효과음이 켜졌어요!" : "🔇 효과음이 꺼졌어요.");
    });

    // 게임 공유 버튼
    document.getElementById("shareGameBtn").addEventListener("click", async () => {
      Sound.click();
      const targetUrl = window.location.protocol.startsWith("http")
        ? window.location.href
        : PUBLIC_GAME_URL;
      const shareData = {
        title: "🏆 사자성어 마스터! - 중학생 525선 인터랙티브 게임",
        text: "STEP 1 학습부터 빈칸 타임어택, 상황별 퀴즈, 최종 마스터 도전까지! 함께 도전해 봐요!",
        url: targetUrl
      };
      if (navigator.share && window.location.protocol.startsWith("http")) {
        try {
          await navigator.share(shareData);
          return;
        } catch (e) {}
      }
      try {
        await navigator.clipboard.writeText(targetUrl);
        showToast("📋 카카오톡 공유용 인터넷 주소가 복사되었어요! 채팅방에 붙여넣기 하세요!");
      } catch (e) {
        showToast("게임 주소: " + targetUrl);
      }
    });

    // 오늘의 사자성어 새로고침 & 상세 보기
    document.getElementById("todayRefreshBtn").addEventListener("click", () => {
      Sound.click();
      renderTodayIdiom();
    });
    document.getElementById("todayHintBtn").addEventListener("click", () => {
      Sound.click();
      openHintModalForIdiom(state.todayIdiom);
    });

    // 시작 화면 하단 퀵 메뉴
    document.getElementById("quickStartCurrentLevelBtn").addEventListener("click", () => {
      Sound.click();
      enterLevelPlay(state.currentLevel, 1, false);
    });
    document.getElementById("quickWrongRetryBtn").addEventListener("click", () => {
      Sound.click();
      if (Object.keys(state.wrongNotes).length === 0) {
        showToast("🎉 현재 틀린 문제가 없어요! 레벨 퀴즈에 도전해 보세요!");
        return;
      }
      enterLevelPlay(state.currentLevel, 2, true);
    });
    document.getElementById("quickCollectionBtn").addEventListener("click", () => {
      Sound.click();
      openCollectionModal("learned");
    });

    // 플레이 화면 상단 컨트롤
    document.getElementById("backToMapBtn").addEventListener("click", () => {
      Sound.click();
      switchView("start");
    });
    document.getElementById("instantHelpBtn").addEventListener("click", () => {
      Sound.click();
      openCurrentQuestionHintModal();
    });

    // STEP 1 ~ 5 탭 전환
    document.querySelectorAll("#stepTabs .step-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        Sound.click();
        const stepNum = Number(tab.dataset.step);
        startStep(stepNum, false);
      });
    });

    // STEP 1 학습 카드 네비게이션
    document.getElementById("studySpeakBtn").addEventListener("click", () => {
      const item = state.session.items[state.session.currentIndex];
      if (item) speakIdiom(item);
    });
    document.getElementById("studyBookmarkBtn").addEventListener("click", () => {
      Sound.click();
      const item = state.session.items[state.session.currentIndex];
      if (!item) return;
      state.learnedIds.add(item.id);
      saveGameData();
      showToast(`⭐ [${item.word}] 사자성어가 학습 도감에 저장되었어요!`);
    });
    document.getElementById("prevStudyCardBtn").addEventListener("click", () => {
      Sound.click();
      if (state.session.currentIndex > 0) {
        state.session.currentIndex -= 1;
        renderStudyStepCard();
      }
    });
    document.getElementById("shuffleStudyBatchBtn").addEventListener("click", () => {
      Sound.click();
      startStep(1, false);
      showToast("🔀 새로운 사자성어 10개를 뽑았어요!");
    });
    document.getElementById("nextStudyCardBtn").addEventListener("click", () => {
      Sound.click();
      const s = state.session;
      if (s.currentIndex + 1 < s.items.length) {
        s.currentIndex += 1;
        renderStudyStepCard();
      } else {
        startStep(2, false);
        showToast("🎯 STEP 1 학습 완료! 이제 STEP 2 객관식 퀴즈에 도전해 보세요!");
      }
    });

    // STEP 2, 4, 5 다음 문제 버튼 (상단 & 하단 2중 스위치)
    document.getElementById("fbNextTopBtn").addEventListener("click", advanceQuestion);
    document.getElementById("fbNextBottomBtn").addEventListener("click", advanceQuestion);

    // STEP 3 빈칸 게임 다음 문제 버튼 (상단 & 하단 2중 스위치)
    document.getElementById("blankNextTopBtn").addEventListener("click", advanceQuestion);
    document.getElementById("blankNextBottomBtn").addEventListener("click", advanceQuestion);

    // 결과 화면 버튼들
    document.getElementById("resRetryStepBtn").addEventListener("click", () => {
      Sound.click();
      enterLevelPlay(state.currentLevel, state.session.step, state.session.isWrongRetry);
    });
    document.getElementById("resReviewWrongBtn").addEventListener("click", () => {
      Sound.click();
      enterLevelPlay(state.currentLevel, 2, true);
    });
    document.getElementById("resGoHomeBtn").addEventListener("click", () => {
      Sound.click();
      switchView("start");
    });

    // 모달 열기/닫기 이벤트
    document.getElementById("openBookModalBtn").addEventListener("click", () => {
      Sound.click();
      openCollectionModal("all");
    });
    document.getElementById("closeBookModalBtn").addEventListener("click", () => {
      Sound.click();
      document.getElementById("modal-collection").classList.add("hidden");
    });
    document.querySelectorAll("#collectionFilterTabs .m-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        Sound.click();
        state.collectionFilter = tab.dataset.filter;
        document.querySelectorAll("#collectionFilterTabs .m-tab").forEach((t) => {
          t.classList.toggle("active", t === tab);
        });
        renderCollectionList();
      });
    });
    document.getElementById("collectionSearchInput").addEventListener("input", (e) => {
      state.collectionSearch = e.target.value;
      renderCollectionList();
    });
    document.getElementById("startWrongQuizFromModalBtn").addEventListener("click", () => {
      Sound.click();
      document.getElementById("modal-collection").classList.add("hidden");
      enterLevelPlay(state.currentLevel, 2, true);
    });

    document.getElementById("openStatsModalBtn").addEventListener("click", () => {
      Sound.click();
      openStatsModal();
    });
    document.getElementById("closeStatsModalBtn").addEventListener("click", () => {
      Sound.click();
      document.getElementById("modal-stats").classList.add("hidden");
    });

    document.getElementById("closeHintModalBtn").addEventListener("click", () => {
      Sound.click();
      document.getElementById("modal-hint").classList.add("hidden");
    });
  }

  function init() {
    loadSaveData();
    updateHUD();
    renderTodayIdiom();
    renderLevelSelectGrid();
    bindEvents();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
