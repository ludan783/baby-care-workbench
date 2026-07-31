/**
 * 宝宝日常照护工作台 - 核心应用逻辑
 * 所有数据通过 localStorage 本地留存
 * 每日 0 点自动重置打卡状态
 */

const STORAGE_KEY = 'babyCareData';
const PROFILE_KEY = 'babyCareProfile';

// ===== 数据存储层 =====
const Store = {
  // 读取全部今日数据
  getAll() {
    const today = this.getTodayKey();
    const raw = localStorage.getItem(STORAGE_KEY);
    const allData = raw ? JSON.parse(raw) : {};
    // 检查日期，自动重置
    if (allData.date !== today) {
      allData.date = today;
      allData.feeding = [];
      allData.pumping = [];
      allData.sleep = [];
      allData.diaper = [];
      allData.todo = [];
      this.saveAll(allData);
    }
    // 确保字段完整
    return Object.assign({
      date: today,
      feeding: [],
      pumping: [],
      sleep: [],
      diaper: [],
      todo: []
    }, allData);
  },

  saveAll(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  getTodayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },

  getProfile() {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : { name: '宝宝', birth: '' };
  },

  saveProfile(p) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  }
};

// ===== 工具函数 =====
function $(id) { return document.getElementById(id); }

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

function formatTime(hhmm) {
  return hhmm || '--:--';
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function calcDuration(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60; // 跨天
  return mins;
}

function calcAge(birth) {
  if (!birth) return '点击设置';
  const b = new Date(birth);
  const now = new Date();
  const days = Math.floor((now - b) / 86400000);
  if (days < 30) return `出生 ${days} 天`;
  const months = Math.floor(days / 30);
  const remainDays = days % 30;
  if (months < 12) return `${months} 个月 ${remainDays} 天`;
  const years = Math.floor(months / 12);
  return `${years} 岁 ${months % 12} 个月`;
}

// ===== 导航切换 =====
function switchPage(pageName) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === pageName);
  });
  document.querySelectorAll('.page').forEach(el => {
    el.classList.toggle('active', el.id === `page-${pageName}`);
  });
}

// ===== 分段选择器通用处理 =====
function initSegmented(containerId, onSelect) {
  const container = $(containerId);
  if (!container) return;
  container.querySelectorAll('.seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (onSelect) onSelect(btn.dataset.value);
    });
  });
}

function getSegmentedValue(containerId) {
  const active = $(containerId).querySelector('.seg-btn.active');
  return active ? active.dataset.value : '';
}

// ===== 数字输入按钮 =====
function initNumberButtons() {
  document.querySelectorAll('.num-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = $(btn.dataset.target);
      const step = parseInt(btn.dataset.step);
      let val = parseInt(target.value) || 0;
      val = Math.max(parseInt(target.min) || 0, val + step);
      if (target.max) val = Math.min(parseInt(target.max), val);
      target.value = val;
      target.dispatchEvent(new Event('input'));
    });
  });
}

// ===== 喝奶记录模块 =====
const Feeding = {
  state: {
    type: 'bottle',
    duration: 15
  },

  init() {
    // 喂养形式切换
    initSegmented('feedTypeSeg', (val) => {
      this.state.type = val;
      $('bottleSection').classList.toggle('hidden', val !== 'bottle');
      $('nursingSection').classList.toggle('hidden', val !== 'nursing');
    });

    initSegmented('bottleContentSeg');
    initSegmented('nursingContentSeg');
    initSegmented('nursingSideSeg');

    // 时长选择
    document.querySelectorAll('.duration-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.duration = parseInt(btn.dataset.min);
      });
    });

    $('submitFeeding').addEventListener('click', () => this.add());
  },

  add() {
    const time = $('feedTime').value;
    if (!time) { toast('请选择喂养时间'); return; }

    const note = $('feedNote').value.trim();
    let record;

    if (this.state.type === 'bottle') {
      const content = getSegmentedValue('bottleContentSeg');
      const amount = parseInt($('feedAmount').value) || 0;
      record = { type: '瓶喂', content, amount, time, note };
    } else {
      const content = getSegmentedValue('nursingContentSeg');
      const side = getSegmentedValue('nursingSideSeg');
      const duration = this.state.duration;
      record = { type: '亲喂', content, side, duration, amount: 0, time, note };
    }

    const data = Store.getAll();
    data.feeding.push(record);
    Store.saveAll(data);
    $('feedNote').value = '';
    this.render();
    Dashboard.render();
    toast('喝奶记录已保存 💾');
  },

  remove(idx) {
    const data = Store.getAll();
    data.feeding.splice(idx, 1);
    Store.saveAll(data);
    this.render();
    Dashboard.render();
  },

  render() {
    const data = Store.getAll();
    const list = data.feeding.sort((a, b) => a.time > b.time ? -1 : 1);
    const container = $('feedingList');

    // 汇总
    const bottleCount = list.filter(r => r.type === '瓶喂').length;
    const nursingCount = list.filter(r => r.type === '亲喂').length;
    const totalMl = list.filter(r => r.type === '瓶喂').reduce((s, r) => s + (r.amount || 0), 0);
    $('feedingCount').textContent = list.length;
    $('feedingTotal').textContent = totalMl;
    $('feedingNursing').textContent = nursingCount;
    $('feedingBottle').textContent = bottleCount;

    if (list.length === 0) {
      container.innerHTML = '<div class="empty-state">还没有喝奶记录</div>';
      return;
    }

    container.innerHTML = list.map((r, i) => {
      const originalIdx = data.feeding.indexOf(r);
      let detail, tags = '';
      if (r.type === '瓶喂') {
        detail = `${r.content} ${r.amount}ml`;
        tags = `<span class="tag ${r.content === '母乳' ? 'tag-breast' : 'tag-formula'}">${r.content}</span>`;
      } else {
        detail = `${r.side} ${r.duration}分钟`;
        tags = `<span class="tag tag-breast">母乳</span><span class="tag ${r.side === '左边' ? 'tag-left' : 'tag-right'}">${r.side}</span><span class="tag tag-method">${r.duration}分钟</span>`;
      }
      const noteHtml = r.note ? `<div style="font-size:12px;color:var(--text-sub);margin-top:2px;">📝 ${r.note}</div>` : '';
      return `
        <div class="record-item">
          <div class="record-main">
            <div class="record-time">⏰ ${r.time}</div>
            <div class="record-detail">${r.type} · ${detail}</div>
            <div class="record-tags">${tags}</div>
            ${noteHtml}
          </div>
          <button class="delete-btn" onclick="Feeding.remove(${originalIdx})">🗑</button>
        </div>
      `;
    }).join('');
  }
};

// ===== 吸奶记录模块 =====
const Pumping = {
  init() {
    // 实时计算合计
    ['pumpLeft', 'pumpRight'].forEach(id => {
      $(id).addEventListener('input', () => this.updateSum());
    });
    $('submitPumping').addEventListener('click', () => this.add());
  },

  updateSum() {
    const left = parseInt($('pumpLeft').value) || 0;
    const right = parseInt($('pumpRight').value) || 0;
    $('pumpSum').textContent = left + right;
  },

  add() {
    const time = $('pumpTime').value;
    if (!time) { toast('请选择吸奶时间'); return; }
    const left = parseInt($('pumpLeft').value) || 0;
    const right = parseInt($('pumpRight').value) || 0;
    if (left + right === 0) { toast('请输入吸奶量'); return; }
    const note = $('pumpNote').value.trim();

    const data = Store.getAll();
    data.pumping.push({ time, left, right, note });
    Store.saveAll(data);
    $('pumpNote').value = '';
    this.render();
    Dashboard.render();
    toast('吸奶记录已保存 💾');
  },

  remove(idx) {
    const data = Store.getAll();
    data.pumping.splice(idx, 1);
    Store.saveAll(data);
    this.render();
    Dashboard.render();
  },

  render() {
    const data = Store.getAll();
    const list = data.pumping.sort((a, b) => a.time > b.time ? -1 : 1);
    const container = $('pumpingList');

    const leftTotal = list.reduce((s, r) => s + r.left, 0);
    const rightTotal = list.reduce((s, r) => s + r.right, 0);
    const grandTotal = leftTotal + rightTotal;
    $('pumpCount').textContent = list.length;
    $('pumpLeftTotal').textContent = leftTotal;
    $('pumpRightTotal').textContent = rightTotal;
    $('pumpGrandTotal').textContent = grandTotal;

    if (list.length === 0) {
      container.innerHTML = '<div class="empty-state">还没有吸奶记录</div>';
      return;
    }

    container.innerHTML = list.map((r) => {
      const originalIdx = data.pumping.indexOf(r);
      const sum = r.left + r.right;
      const noteHtml = r.note ? `<div style="font-size:12px;color:var(--text-sub);margin-top:2px;">📝 ${r.note}</div>` : '';
      return `
        <div class="record-item">
          <div class="record-main">
            <div class="record-time">⏰ ${r.time}</div>
            <div class="record-detail">左 ${r.left}ml + 右 ${r.right}ml = <strong style="color:var(--primary-dark)">${sum}ml</strong></div>
            <div class="record-tags">
              <span class="tag tag-left">左 ${r.left}ml</span>
              <span class="tag tag-right">右 ${r.right}ml</span>
            </div>
            ${noteHtml}
          </div>
          <button class="delete-btn" onclick="Pumping.remove(${originalIdx})">🗑</button>
        </div>
      `;
    }).join('');
  }
};

// ===== 睡眠记录模块 =====
const Sleep = {
  init() {
    initSegmented('sleepMethodSeg');
    initSegmented('sleepHelperSeg');
    initSegmented('sleepCrySeg');

    // 实时计算时长
    ['sleepStart', 'sleepEnd'].forEach(id => {
      $(id).addEventListener('input', () => this.updateDuration());
    });
    $('submitSleep').addEventListener('click', () => this.add());
  },

  updateDuration() {
    const start = $('sleepStart').value;
    const end = $('sleepEnd').value;
    if (start && end) {
      $('sleepDuration').textContent = calcDuration(start, end);
    } else {
      $('sleepDuration').textContent = '0';
    }
  },

  add() {
    const start = $('sleepStart').value;
    const end = $('sleepEnd').value;
    if (!start || !end) { toast('请选择开始和结束时间'); return; }
    const duration = calcDuration(start, end);
    if (duration === 0) { toast('时长不能为0'); return; }

    const method = getSegmentedValue('sleepMethodSeg');
    const helper = getSegmentedValue('sleepHelperSeg');
    const cry = getSegmentedValue('sleepCrySeg');
    const note = $('sleepNote').value.trim();

    const data = Store.getAll();
    data.sleep.push({ start, end, duration, method, helper, cry, note });
    Store.saveAll(data);
    $('sleepNote').value = '';
    this.render();
    Dashboard.render();
    toast('睡眠记录已保存 💾');
  },

  remove(idx) {
    const data = Store.getAll();
    data.sleep.splice(idx, 1);
    Store.saveAll(data);
    this.render();
    Dashboard.render();
  },

  render() {
    const data = Store.getAll();
    const list = data.sleep.sort((a, b) => a.start > b.start ? -1 : 1);
    const container = $('sleepList');

    const totalMins = list.reduce((s, r) => s + r.duration, 0);
    const cryCount = list.filter(r => r.cry === '有').length;
    $('sleepCount').textContent = list.length;
    $('sleepTotal').textContent = totalMins;
    $('sleepCryCount').textContent = cryCount;

    if (list.length === 0) {
      container.innerHTML = '<div class="empty-state">还没有睡眠记录</div>';
      return;
    }

    container.innerHTML = list.map((r) => {
      const originalIdx = data.sleep.indexOf(r);
      const noteHtml = r.note ? `<div style="font-size:12px;color:var(--text-sub);margin-top:2px;">📝 ${r.note}</div>` : '';
      return `
        <div class="record-item">
          <div class="record-main">
            <div class="record-time">😴 ${r.start} → 😊 ${r.end}</div>
            <div class="record-detail">睡眠时长 <strong style="color:var(--primary-dark)">${r.duration}</strong> 分钟</div>
            <div class="record-tags">
              <span class="tag tag-method">${r.method}</span>
              <span class="tag tag-helper">辅助: ${r.helper}</span>
              <span class="tag ${r.cry === '有' ? 'tag-cry' : 'tag-nocry'}">${r.cry === '有' ? '😢 有哭闹' : '😊 无哭闹'}</span>
            </div>
            ${noteHtml}
          </div>
          <button class="delete-btn" onclick="Sleep.remove(${originalIdx})">🗑</button>
        </div>
      `;
    }).join('');
  }
};

// ===== 换尿布记录模块 =====
const Diaper = {
  init() {
    initSegmented('diaperTypeSeg');
    initSegmented('diaperLeakSeg');
    $('submitDiaper').addEventListener('click', () => this.add());
  },

  add() {
    const time = $('diaperTime').value;
    if (!time) { toast('请选择更换时间'); return; }
    const type = getSegmentedValue('diaperTypeSeg');
    const leak = getSegmentedValue('diaperLeakSeg');
    const note = $('diaperNote').value.trim();

    const data = Store.getAll();
    data.diaper.push({ time, type, leak, note });
    Store.saveAll(data);
    $('diaperNote').value = '';
    this.render();
    Dashboard.render();
    toast('换尿布记录已保存 💾');
  },

  remove(idx) {
    const data = Store.getAll();
    data.diaper.splice(idx, 1);
    Store.saveAll(data);
    this.render();
    Dashboard.render();
  },

  render() {
    const data = Store.getAll();
    const list = data.diaper.sort((a, b) => a.time > b.time ? -1 : 1);
    const container = $('diaperList');

    const wet = list.filter(r => r.type === '湿了').length;
    const dirty = list.filter(r => r.type === '脏了').length;
    const mix = list.filter(r => r.type === '混合').length;
    const leakCount = list.filter(r => r.leak === '有').length;
    $('diaperCount').textContent = list.length;
    $('diaperWet').textContent = wet;
    $('diaperDirty').textContent = dirty;
    $('diaperMix').textContent = mix;
    $('diaperLeak').textContent = leakCount;

    if (list.length === 0) {
      container.innerHTML = '<div class="empty-state">还没有换尿布记录</div>';
      return;
    }

    container.innerHTML = list.map((r) => {
      const originalIdx = data.diaper.indexOf(r);
      const typeClass = r.type === '湿了' ? 'tag-wet' : (r.type === '脏了' ? 'tag-dirty' : 'tag-mix');
      const noteHtml = r.note ? `<div style="font-size:12px;color:var(--text-sub);margin-top:2px;">📝 ${r.note}</div>` : '';
      return `
        <div class="record-item">
          <div class="record-main">
            <div class="record-time">⏰ ${r.time}</div>
            <div class="record-detail">${r.type}</div>
            <div class="record-tags">
              <span class="tag ${typeClass}">${r.type}</span>
              <span class="tag ${r.leak === '有' ? 'tag-leak' : 'tag-nocry'}">${r.leak === '有' ? '💦 漏尿' : '😊 无漏尿'}</span>
            </div>
            ${noteHtml}
          </div>
          <button class="delete-btn" onclick="Diaper.remove(${originalIdx})">🗑</button>
        </div>
      `;
    }).join('');
  }
};

// ===== 今日待办模块 =====
const Todo = {
  init() {
    $('submitTodo').addEventListener('click', () => this.add());
    $('todoInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.add();
    });
    // 快捷标签
    document.querySelectorAll('.quick-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        $('todoInput').value = tag.dataset.text;
        this.add();
      });
    });
  },

  add() {
    const text = $('todoInput').value.trim();
    if (!text) { toast('请输入待办内容'); return; }
    const data = Store.getAll();
    data.todo.push({ text, done: false, time: nowHHMM() });
    Store.saveAll(data);
    $('todoInput').value = '';
    this.render();
    Dashboard.render();
    toast('待办已添加 ✅');
  },

  toggle(idx) {
    const data = Store.getAll();
    if (data.todo[idx]) {
      data.todo[idx].done = !data.todo[idx].done;
      Store.saveAll(data);
      this.render();
      Dashboard.render();
    }
  },

  remove(idx) {
    const data = Store.getAll();
    data.todo.splice(idx, 1);
    Store.saveAll(data);
    this.render();
    Dashboard.render();
  },

  render() {
    const data = Store.getAll();
    const list = data.todo;
    const container = $('todoList');

    const done = list.filter(t => t.done).length;
    $('todoTotal').textContent = list.length;
    $('todoDone').textContent = done;
    $('todoPending').textContent = list.length - done;

    if (list.length === 0) {
      container.innerHTML = '<div class="empty-state">还没有待办事项，快添加一个吧～</div>';
      return;
    }

    container.innerHTML = list.map((t, i) => `
      <div class="todo-item ${t.done ? 'done' : ''}">
        <div class="todo-check ${t.done ? 'done' : ''}" onclick="Todo.toggle(${i})"></div>
        <div class="todo-text">${t.text}</div>
        <div class="todo-time">${t.time}</div>
        <button class="delete-btn" onclick="Todo.remove(${i})">🗑</button>
      </div>
    `).join('');
  }
};

// ===== 今日概览模块 =====
const Dashboard = {
  render() {
    const data = Store.getAll();

    // 喝奶
    const feedList = data.feeding;
    const feedMl = feedList.filter(r => r.type === '瓶喂').reduce((s, r) => s + (r.amount || 0), 0);
    $('dashFeeding').textContent = `${feedList.length} 次`;
    $('dashFeedingDetail').textContent = feedList.length > 0 ? `总奶量 ${feedMl}ml` : '暂无记录';

    // 吸奶
    const pumpTotal = data.pumping.reduce((s, r) => s + r.left + r.right, 0);
    $('dashPumping').textContent = `${pumpTotal} ml`;
    $('dashPumpingDetail').textContent = `${data.pumping.length} 次 · 今日总量`;

    // 睡眠
    const sleepTotal = data.sleep.reduce((s, r) => s + r.duration, 0);
    $('dashSleep').textContent = `${sleepTotal} 分钟`;
    $('dashSleepDetail').textContent = `${data.sleep.length} 次`;

    // 尿布
    $('dashDiaper').textContent = `${data.diaper.length} 次`;
    $('dashDiaperDetail').textContent = '今日更换';

    // 待办
    const todoDone = data.todo.filter(t => t.done).length;
    $('dashTodo').textContent = `${todoDone} / ${data.todo.length}`;
    $('dashTodoDetail').textContent = '已完成 / 总数';

    // 时间线
    this.renderTimeline(data);
  },

  renderTimeline(data) {
    const items = [];
    data.feeding.forEach(r => items.push({ time: r.time, sort: r.time, icon: '🍼', text: `喝奶 · ${r.type} ${r.content || ''} ${r.amount ? r.amount+'ml' : (r.duration? r.duration+'分钟':'')}`, tag: r.type }));
    data.pumping.forEach(r => items.push({ time: r.time, sort: r.time, icon: '泵奶', text: `吸奶 · 左${r.left}ml 右${r.right}ml`, tag: '吸奶' }));
    data.sleep.forEach(r => items.push({ time: r.start, sort: r.start, icon: '😴', text: `睡眠 · ${r.start}-${r.end} (${r.duration}分钟)`, tag: '睡眠' }));
    data.diaper.forEach(r => items.push({ time: r.time, sort: r.time, icon: '🧷', text: `换尿布 · ${r.type}`, tag: r.type }));

    items.sort((a, b) => a.sort > b.sort ? -1 : 1);
    const container = $('todayTimeline');

    if (items.length === 0) {
      container.innerHTML = '<div class="empty-state">暂无记录，快去添加第一条吧～</div>';
      return;
    }

    container.innerHTML = items.map(it => `
      <div class="timeline-item">
        <div class="timeline-time">${it.time}</div>
        <div class="timeline-content">${it.icon} ${it.text}</div>
      </div>
    `).join('');
  }
};

// ===== 设置模块 =====
const Settings = {
  init() {
    $('settingsBtn').addEventListener('click', () => this.open());
    $('cancelSettings').addEventListener('click', () => this.close());
    $('saveSettings').addEventListener('click', () => this.save());
    $('settingsModal').addEventListener('click', (e) => {
      if (e.target.id === 'settingsModal') this.close();
    });
    this.renderProfile();
  },

  open() {
    const p = Store.getProfile();
    $('inputBabyName').value = p.name || '';
    $('inputBabyBirth').value = p.birth || '';
    $('settingsModal').classList.add('show');
  },

  close() {
    $('settingsModal').classList.remove('show');
  },

  save() {
    const name = $('inputBabyName').value.trim() || '宝宝';
    const birth = $('inputBabyBirth').value;
    Store.saveProfile({ name, birth });
    this.renderProfile();
    this.close();
    toast('设置已保存 ⚙️');
  },

  renderProfile() {
    const p = Store.getProfile();
    $('babyName').textContent = p.name || '宝宝';
    $('babyAge').textContent = calcAge(p.birth);
  }
};

// ===== 每日重置 =====
function resetToday() {
  const today = Store.getTodayKey();
  const data = Store.getAll();
  data.date = today;
  data.feeding = [];
  data.pumping = [];
  data.sleep = [];
  data.diaper = [];
  data.todo = [];
  Store.saveAll(data);
  Feeding.render();
  Pumping.render();
  Sleep.render();
  Diaper.render();
  Todo.render();
  Dashboard.render();
  toast('今日打卡已重置 🔄');
}

// ===== 初始化 =====
function init() {
  // 设置默认时间为当前
  const now = nowHHMM();
  ['feedTime', 'pumpTime', 'diaperTime'].forEach(id => {
    if ($(id)) $(id).value = now;
  });

  // 导航绑定
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => switchPage(item.dataset.page));
  });

  // 概览卡片跳转
  document.querySelectorAll('.dash-card').forEach(card => {
    card.addEventListener('click', () => switchPage(card.dataset.jump));
  });

  // 重置按钮
  $('resetBtn').addEventListener('click', () => {
    if (confirm('确定要重置今日所有打卡记录吗？此操作不可撤销。')) {
      resetToday();
    }
  });

  // 初始化各模块
  Settings.init();
  Feeding.init();
  Pumping.init();
  Sleep.init();
  Diaper.init();
  Todo.init();

  // 渲染所有页面数据
  Feeding.render();
  Pumping.render();
  Sleep.render();
  Diaper.render();
  Todo.render();
  Dashboard.render();

  // 显示今日日期
  const d = new Date();
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  $('todayDate').textContent = `${d.getMonth()+1}月${d.getDate()}日 周${weekDays[d.getDay()]}`;

  // 每日自动重置检测（每分钟检查一次日期变化）
  let lastDate = Store.getTodayKey();
  setInterval(() => {
    const today = Store.getTodayKey();
    if (today !== lastDate) {
      lastDate = today;
      resetToday();
      toast('新的一天，打卡已自动重置 🌅');
    }
  }, 60000);

  // 页面可见时也检查（从后台切回前台）
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      const today = Store.getTodayKey();
      if (today !== lastDate) {
        lastDate = today;
        resetToday();
      }
    }
  });
}

// 启动
document.addEventListener('DOMContentLoaded', init);

// ===== Service Worker 注册（实现离线访问） =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      console.log('Service Worker 已注册，离线缓存已启用');
    }).catch((err) => {
      console.log('Service Worker 注册失败:', err);
    });
  });
}
