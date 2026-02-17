const { useState, useEffect, useRef, useMemo } = React;

// --- 1. 基础配置与常量 ---
const STORAGE_KEY = 'deonysus_anchor_data_v1';
const TIMER_STATE_KEY = 'deonysus_active_timer_v1';
const SETTINGS_KEY = 'deonysus_settings_v1';

// 预设调色盘 (温柔系 + 莫兰迪)
const COLOR_PALETTE = [
    '#FF6B6B', // 暖红
    '#54A0FF', // 活泼蓝
    '#1DD1A1', // 清新绿
    '#FECA57', // 温暖黄
    '#5F27CD', // 神秘紫
    '#FF9F43', // 活力橙
    '#48DBFB', // 天空青
    '#8395A7', // 沉稳灰
    '#FF9FF3', // 糖果粉
    '#00D2D3'  // 蒂芙尼蓝
];

const HABIT_CONFIG = {
    water: { label: "💧 饮水守护", max: 8, desc: "≥300ml 对抗结石", type: "infinite", color: "bg-blue-100 text-blue-600" },
    poop: { label: "💩 顺畅守护", max: 1, desc: "身体净化完成", type: "count", color: "bg-amber-100 text-amber-700" },
    spine: { label: "🚶‍♀️ 脊柱活动", max: 2, desc: "上下午各一次拉伸", type: "count", color: "bg-green-100 text-green-700" },
    sleep: { label: "🌙 睡前锚点", max: 1, desc: "23:00 前开始仪式", type: "count", color: "bg-indigo-100 text-indigo-600" },
    impulse: { label: "🧠 冲动记录", max: 999, desc: "护甲：觉察与停顿", type: "infinite", color: "bg-rose-100 text-rose-600" }
};

// --- 2. 工具函数与数据库 ---
const LocalDB = {
    getAll: () => {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
    },
    saveAll: (data) => { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); },
    
    getToday: (dateKey) => {
        const all = LocalDB.getAll();
        const day = all[dateKey] || { water: 0, poop: 0, spine: 0, sleep: 0, impulse: 0, timeLogs: [], impulseRecords: [] };
        if (!day.timeLogs) day.timeLogs = [];
        if (!day.impulseRecords) day.impulseRecords = [];
        return day;
    },
    updateToday: (dateKey, newData) => {
        const all = LocalDB.getAll();
        all[dateKey] = { ...newData, lastUpdate: Date.now() };
        LocalDB.saveAll(all);
    },
    getTimerState: () => {
        try { return JSON.parse(localStorage.getItem(TIMER_STATE_KEY)); } catch { return null; }
    },
    saveTimerState: (state) => {
        if (!state) localStorage.removeItem(TIMER_STATE_KEY);
        else localStorage.setItem(TIMER_STATE_KEY, JSON.stringify(state));
    },
    getSettings: () => {
        try { 
            let settings = JSON.parse(localStorage.getItem(SETTINGS_KEY));
            if (!settings) {
                settings = { tags: [
                    { name: '工作', color: COLOR_PALETTE[0] },
                    { name: '学习', color: COLOR_PALETTE[1] },
                    { name: '阅读', color: COLOR_PALETTE[2] },
                    { name: '运动', color: COLOR_PALETTE[3] }
                ]};
            }
            if (settings.tags.length > 0 && typeof settings.tags[0] === 'string') {
                settings.tags = settings.tags.map((t, i) => ({
                    name: t,
                    color: COLOR_PALETTE[i % COLOR_PALETTE.length]
                }));
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
            }
            return settings;
        } catch { 
            return { tags: [
                { name: '工作', color: COLOR_PALETTE[0] },
                { name: '学习', color: COLOR_PALETTE[1] }
            ] }; 
        }
    },
    saveSettings: (settings) => {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    },
    importData: (fileContent) => {
        try {
            const jsonData = JSON.parse(fileContent);
            if (jsonData.logs) {
                const current = LocalDB.getAll();
                const merged = { ...current, ...jsonData.logs };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
                if (jsonData.settings) localStorage.setItem(SETTINGS_KEY, JSON.stringify(jsonData.settings));
                return { success: true, type: 'JSON', count: Object.keys(jsonData.logs).length };
            }
        } catch (e) {}
        return { success: false };
    }
};

const getShanghaiDate = () => {
    const formatter = new Intl.DateTimeFormat('en-CA', { 
        timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' 
    });
    return formatter.format(new Date());
};
const formatTimeHHMMSS = (seconds) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};
const formatDuration = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    return `${m}m`;
};
const formatSmartDuration = (seconds) => {
    const m = seconds / 60;
    if (m < 60) return `${m.toFixed(1)}m`;
    return `${(m / 60).toFixed(1)}h`;
};

// --- 3. 图标组件 ---
const Icons = {
    Chart: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    Refresh: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>,
    Check: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    Plus: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    X: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    Trash: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
    Download: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
    Upload: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
    Play: () => <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M5 3l14 9-14 9V3z" strokeLinejoin="round" strokeWidth="2"/></svg>,
    Pause: () => <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>,
    Stop: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="4" y="4" width="16" height="16" rx="4" ry="4"></rect></svg>,
    TabHabit: () => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>,
    TabTime: () => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    Tag: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
    Left: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
    Right: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
    Calendar: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    List: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
    Moon: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>,
    Edit: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    Settings: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
};

// --- 4. 子组件定义 ---

const HabitCard = ({ config, value, onIncrement, isNight }) => {
    const isTargetReached = value >= config.max;
    const isClickable = config.type === 'infinite' || !isTargetReached;
    const percentage = Math.min((value / config.max) * 100, 100);
    return (
        <div onClick={isClickable ? onIncrement : undefined} className={`relative overflow-hidden rounded-3xl p-4 transition-all duration-300 select-none border-2 ${isClickable ? 'cursor-pointer active:scale-[0.98]' : 'cursor-default'} ${
            isTargetReached ? 
                (isNight ? 'bg-indigo-900/40 border-indigo-800 opacity-60' : 'bg-white border-warm-200 opacity-80') : 
                (isNight ? 'bg-[#2a2a3e] border-[#3a3a4e] soft-shadow hover:border-indigo-400' : 'bg-white border-white soft-shadow hover:border-warm-200')
        }`}>
            <div className={`absolute bottom-0 left-0 h-1.5 transition-all duration-500 rounded-r-full ${isNight ? 'bg-indigo-500' : 'bg-warm-300'}`} style={{ width: `${percentage}%`, opacity: isTargetReached ? 0 : 0.5 }} />
            <div className="flex justify-between items-center relative z-10">
                <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm ${
                        isNight ? 'bg-indigo-800/50 text-indigo-200' : config.color.split(' ')[0] + ' ' + config.color.split(' ')[1]
                    }`}>{config.label.split(' ')[0]}</div>
                    <div>
                        <h3 className={`font-bold text-lg flex items-center gap-2 ${
                            isTargetReached ? (isNight ? 'text-indigo-400 line-through' : 'text-warm-400 line-through') : (isNight ? 'text-indigo-100' : 'text-ink')
                        }`}>{config.label.split(' ')[1]} {isTargetReached && <span className={isNight ? "text-indigo-400" : "text-warm-500"}><Icons.Check /></span>}</h3>
                        <p className={`text-xs font-bold mt-0.5 ${isNight ? 'text-indigo-300/50' : 'text-ink/40'}`}>{config.desc}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right"><span className={`text-2xl font-bold font-mono ${
                        isTargetReached ? (isNight ? 'text-indigo-800' : 'text-warm-300') : (isNight ? 'text-indigo-300' : 'text-warm-600')
                    }`}>{value}</span><span className={`text-xs font-bold ${isNight ? 'text-indigo-800' : 'text-warm-300'}`}>/{config.max}</span></div>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-all border-b-2 active:border-b-0 active:translate-y-0.5 ${
                        isTargetReached ? 
                            (config.type === 'infinite' ? (isNight ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-warm-400 text-white border-warm-500') : (isNight ? 'bg-gray-800 text-gray-600 border-gray-700' : 'bg-gray-100 text-gray-300 border-gray-200')) : 
                            (isNight ? 'bg-indigo-900 text-indigo-300 border-indigo-800' : 'bg-warm-100 text-warm-600 border-warm-200')
                    }`}><Icons.Plus /></div>
                </div>
            </div>
        </div>
    );
};

const ImpulseModal = ({ onClose, onConfirm }) => {
    const [note, setNote] = useState('');
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white w-full max-w-xs rounded-3xl shadow-2xl relative z-10 p-5 animate-breathe border-4 border-berry-100">
                <h3 className="text-lg font-bold text-ink mb-1">接住你了</h3>
                <p className="text-xs text-ink/50 mb-4 font-bold">告诉我，发生了什么？（不想说也没关系）</p>
                <textarea 
                    className="w-full bg-warm-50 border border-warm-200 rounded-xl p-3 text-sm outline-none focus:border-berry-300 focus:ring-2 focus:ring-berry-100 transition-all mb-4 h-24 resize-none"
                    placeholder="比如：焦虑、无聊、牙痒痒..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    autoFocus
                />
                <div className="flex gap-2">
                    <button onClick={() => onConfirm('')} className="flex-1 py-3 text-berry-400 bg-white border border-berry-100 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-berry-100">只记数字</button>
                    <button onClick={() => onConfirm(note)} className="flex-[2] py-3 text-white bg-berry-500 rounded-xl font-bold shadow-md text-sm outline-none focus:ring-2 focus:ring-berry-300 focus:ring-offset-1">记下来</button>
                </div>
            </div>
        </div>
    );
};

const DonutChart = ({ logs, tags }) => {
    const totalDuration = logs.reduce((acc, log) => acc + log.duration, 0);
    
    if (totalDuration === 0) return (
        <div className="flex flex-col items-center justify-center py-8 text-warm-300">
            <div className="w-32 h-32 rounded-full border-4 border-warm-100 mb-2 flex items-center justify-center">
                <span className="text-2xl opacity-20">🕒</span>
            </div>
            <span className="text-xs font-bold">今天还没有开始专注哦</span>
        </div>
    );

    const tagDurations = {};
    logs.forEach(log => {
        tagDurations[log.name] = (tagDurations[log.name] || 0) + log.duration;
    });

    let cumulativePercent = 0;
    const slices = Object.entries(tagDurations).map(([tagName, duration]) => {
        const percent = duration / totalDuration;
        const startP = cumulativePercent;
        cumulativePercent += percent;
        const tagConfig = tags.find(t => t.name === tagName);
        const color = tagConfig ? tagConfig.color : '#E0E0E0';
        return { name: tagName, percent, startP, color };
    }).sort((a,b) => b.percent - a.percent);

    const size = 160;
    const strokeWidth = 25;
    const radius = (size - strokeWidth) / 2;
    const center = size / 2;
    const circumference = 2 * Math.PI * radius;

    return (
        <div className="flex items-center gap-6 bg-white p-5 rounded-3xl soft-shadow border border-warm-50 mb-6">
            <div className="relative w-32 h-32 flex-shrink-0">
                <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
                    <circle cx={center} cy={center} r={radius} fill="none" stroke="#FFF0D4" strokeWidth={strokeWidth} />
                    {slices.map((slice, i) => (
                        <circle
                            key={i}
                            cx={center}
                            cy={center}
                            r={radius}
                            fill="none"
                            stroke={slice.color}
                            strokeWidth={strokeWidth}
                            strokeDasharray={circumference}
                            strokeDashoffset={circumference * (1 - slice.percent)}
                            style={{ 
                                transition: 'all 0.5s ease-out',
                                transformOrigin: 'center',
                                transform: `rotate(${slice.startP * 360}deg)`
                            }}
                        />
                    ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none rotate-0">
                    <span className="text-xs font-bold text-warm-300">总专注</span>
                    <span className="text-lg font-bold font-mono text-warm-600">{formatSmartDuration(totalDuration).replace('h','小时').replace('m','分钟')}</span>
                </div>
            </div>
            <div className="flex-1 space-y-2 max-h-32 overflow-y-auto">
                {slices.map((slice, i) => (
                    <div key={i} className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: slice.color}}></div>
                            <span className="font-bold text-ink/80">{slice.name}</span>
                        </div>
                        <span className="font-mono text-warm-400 font-bold">{Math.round(slice.percent * 100)}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const TimeTracker = ({ logs, onSaveLog, onDeleteLog, tags, onAddTag, onUpdateTag, onDeleteTag }) => {
    const [status, setStatus] = useState('idle');
    const [elapsed, setElapsed] = useState(0);
    const [selectedTag, setSelectedTag] = useState(tags[0] || {name:'默认', color:'#ccc'});
    
    // 弹窗相关状态
    const [dialogMode, setDialogMode] = useState('select'); // 'select' | 'edit'
    const [customTagInput, setCustomTagInput] = useState('');
    const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0]);
    const [editingOriginalName, setEditingOriginalName] = useState(null); // 记录正在编辑的旧名字

    const timerRef = useRef(null);

    // 初始化
    useEffect(() => {
        const saved = LocalDB.getTimerState();
        if (saved) {
            const savedTagName = typeof saved.tag === 'string' ? saved.tag : saved.tag.name;
            const foundTag = tags.find(t => t.name === savedTagName) || tags[0];
            setSelectedTag(foundTag);
            
            if (saved.status === 'running') {
                const now = Date.now();
                const diff = Math.floor((now - saved.lastTick) / 1000);
                setElapsed(saved.elapsed + diff);
                setStatus('running');
            } else {
                setElapsed(saved.elapsed);
                setStatus(saved.status);
            }
        }
    }, [tags]);

    // 唤醒与状态保持
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                const saved = LocalDB.getTimerState();
                if (saved && saved.status === 'running') {
                    const now = Date.now();
                    const diff = Math.floor((now - saved.lastTick) / 1000);
                    setElapsed(saved.elapsed + diff);
                }
            } else {
                if (status === 'running' || status === 'paused') {
                    LocalDB.saveTimerState({ status, elapsed, lastTick: Date.now(), tag: selectedTag.name });
                }
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }, [status, elapsed, selectedTag]);

    useEffect(() => {
        if (status === 'running') {
            timerRef.current = setInterval(() => {
                setElapsed(prev => prev + 1); 
            }, 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [status]);

    useEffect(() => {
        if (status === 'running' || status === 'paused') {
             LocalDB.saveTimerState({ status, elapsed, lastTick: Date.now(), tag: selectedTag.name });
        }
    }, [status, selectedTag]);

    const handleStart = () => setStatus('running');
    const handlePause = () => setStatus('paused');
    const handleStop = () => {
        if (elapsed > 5) {
            onSaveLog({ id: Date.now(), name: selectedTag.name, duration: elapsed, timestamp: Date.now() });
        }
        setStatus('idle');
        setElapsed(0);
        LocalDB.saveTimerState(null);
    };

    // 标签管理逻辑
    const openDialog = () => {
        if (status === 'idle') {
            setDialogMode('select'); // 默认打开是选择模式
            setCustomTagInput('');
            setSelectedColor(COLOR_PALETTE[0]);
            setEditingOriginalName(null);
            document.getElementById('tag-dialog').showModal();
        }
    };

    const handleTagClick = (tag) => {
        if (dialogMode === 'select') {
            // 选择模式：选中并关闭
            setSelectedTag(tag);
            document.getElementById('tag-dialog').close();
        } else {
            // 编辑模式：填充表单，准备修改
            setCustomTagInput(tag.name);
            setSelectedColor(tag.color);
            setEditingOriginalName(tag.name);
        }
    };

    const handleSaveTag = () => {
        if (!customTagInput.trim()) return;
        
        const newName = customTagInput.trim();
        const newColor = selectedColor;

        if (dialogMode === 'edit' && editingOriginalName) {
            // 修改现有标签
            onUpdateTag(editingOriginalName, newName, newColor);
            // 如果改的是当前选中的标签，也要更新状态
            if (selectedTag.name === editingOriginalName) {
                setSelectedTag({ name: newName, color: newColor });
            }
            setEditingOriginalName(null);
            setCustomTagInput('');
        } else {
            // 新增标签
            onAddTag({ name: newName, color: newColor });
            setSelectedTag({ name: newName, color: newColor });
            setCustomTagInput('');
        }
        
        // 保存后如果不关闭弹窗，用户可以继续操作，或者关闭。这里选择清空输入
        if (dialogMode === 'select') {
            document.getElementById('tag-dialog').close();
        } else {
             // 编辑模式下保存后，清空输入框，方便下一次操作
             setCustomTagInput('');
             setEditingOriginalName(null);
        }
    };

    const handleDelete = () => {
        if (editingOriginalName) {
            onDeleteTag(editingOriginalName);
            if (selectedTag.name === editingOriginalName) {
                setSelectedTag(tags[0] || {name:'默认', color:'#ccc'});
            }
            setCustomTagInput('');
            setEditingOriginalName(null);
        }
    };

    const currentTagColor = selectedTag ? selectedTag.color : '#ccc';

    return (
        <div className="space-y-6 pt-4">
            <DonutChart logs={logs} tags={tags} />
            
            {/* 这里的计时器变成了一个完整的一体化控制台 */}
            <div className="relative py-4">
                <div 
                    className={`relative z-10 w-full p-6 bg-white rounded-3xl soft-shadow border flex flex-col items-center justify-between transition-all duration-500 ${status === 'running' ? 'animate-breathe' : ''}`}
                    style={{ borderColor: status === 'running' ? currentTagColor : '#FFF0D4', minHeight: '300px' }} 
                >
                    {/* 上部分：标签和状态 */}
                    <div className="w-full flex justify-between items-start mb-2">
                         <div className="flex items-center gap-2 bg-paper border border-warm-200 px-3 py-1.5 rounded-full cursor-pointer hover:border-warm-400" onClick={openDialog}>
                                <div className="w-2 h-2 rounded-full" style={{backgroundColor: currentTagColor}}></div>
                                <span className="text-sm font-bold text-ink">{selectedTag.name}</span>
                                <Icons.Tag />
                         </div>
                         <div className="text-xs font-bold text-warm-300 uppercase tracking-widest py-1.5">{status === 'running' ? 'Focusing...' : 'Ready'}</div>
                    </div>

                    {/* 中部分：时间 */}
                    <div className="flex-1 flex items-center justify-center py-4">
                        <div className="text-6xl font-bold font-mono tracking-widest tabular-nums" style={{color: status === 'running' ? currentTagColor : '#E67E22'}}>
                            {formatTimeHHMMSS(elapsed)}
                        </div>
                    </div>
                    
                    {/* 下部分：按钮组 (直接在卡片内) */}
                    <div className="flex items-center gap-6 mt-2 relative z-20 w-full justify-center">
                        {status === 'running' ? (
                            <button onClick={handlePause} className="w-20 h-20 p-5 rounded-full bg-amber-100 text-amber-500 border-4 border-white shadow-lg active:scale-95 transition-all flex items-center justify-center"><Icons.Pause /></button>
                        ) : (
                            <button onClick={handleStart} className="w-20 h-20 p-5 rounded-full bg-warm-500 text-white border-4 border-white shadow-xl active:scale-95 transition-all flex items-center justify-center"><Icons.Play /></button>
                        )}
                        {(status === 'running' || status === 'paused') && (
                            <button onClick={handleStop} className="w-16 h-16 p-4 rounded-full bg-warm-50 text-warm-400 border-4 border-white shadow-md active:scale-95 transition-all flex items-center justify-center"><Icons.Stop /></button>
                        )}
                    </div>
                </div>
            </div>

            <dialog id="tag-dialog" className="p-0 rounded-2xl backdrop:bg-ink/20 border-0 shadow-xl">
                <div className="bg-white p-5 w-80">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-ink">
                            {dialogMode === 'select' ? '选择标签' : '管理标签'}
                        </h3>
                        <button 
                            onClick={() => {
                                setDialogMode(prev => prev === 'select' ? 'edit' : 'select');
                                setCustomTagInput('');
                                setEditingOriginalName(null);
                            }}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 outline-none focus:ring-2 focus:ring-warm-300 focus:ring-offset-1 ${dialogMode === 'edit' ? 'bg-ink text-white' : 'bg-warm-100 text-warm-600'}`}
                        >
                            <Icons.Settings /> {dialogMode === 'select' ? '管理' : '完成'}
                        </button>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4 max-h-40 overflow-y-auto p-1">
                        {tags.map((t, i) => (
                            <button 
                                key={i} 
                                onClick={() => handleTagClick(t)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-bold border-2 flex items-center gap-2 transition-all outline-none focus:ring-2 focus:ring-warm-400 focus:ring-offset-1 
                                    ${(dialogMode === 'edit' && editingOriginalName === t.name) ? 'ring-2 ring-berry-400 ring-offset-1 border-berry-400' : ''}
                                    ${(selectedTag.name === t.name && dialogMode === 'select') ? 'bg-warm-100 border-warm-400 text-warm-700' : 'bg-white border-warm-100 text-ink/60'}
                                `}
                            >
                                <div className="w-2 h-2 rounded-full" style={{backgroundColor: t.color}}></div>
                                {t.name}
                                {dialogMode === 'edit' && <span className="text-[10px] ml-1 opacity-50">✎</span>}
                            </button>
                        ))}
                    </div>

                    <div className={`border-t border-dashed border-warm-200 pt-3 transition-all ${dialogMode === 'edit' ? 'bg-warm-50 -mx-5 px-5 pb-2 pt-4' : ''}`}>
                        <div className="text-xs font-bold text-warm-300 mb-2">
                            {dialogMode === 'edit' ? (editingOriginalName ? '修改标签信息' : '添加新标签') : '新建标签'}
                        </div>
                        <div className="flex gap-2 mb-3 overflow-x-auto p-2 -mx-2">
                            {COLOR_PALETTE.map(c => (
                                <button 
                                    key={c} 
                                    onClick={() => setSelectedColor(c)}
                                    className={`w-6 h-6 rounded-full flex-shrink-0 transition-transform outline-none focus:ring-2 focus:ring-warm-400 focus:ring-offset-1 ${selectedColor === c ? 'scale-125 ring-2 ring-offset-1 ring-warm-300' : ''}`}
                                    style={{backgroundColor: c}}
                                />
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input 
                                className="flex-1 bg-white px-3 py-2 rounded-xl border border-warm-200 text-sm outline-none focus:border-warm-400 focus:ring-2 focus:ring-warm-100"
                                placeholder={dialogMode === 'edit' ? "标签名称" : "输入新标签名"}
                                value={customTagInput}
                                onChange={e => setCustomTagInput(e.target.value)}
                                onKeyDown={(e) => { if(e.key === 'Enter') handleSaveTag(); }}
                            />
                            {dialogMode === 'edit' && editingOriginalName && (
                                <button onClick={handleDelete} className="px-3 rounded-xl bg-white border border-rose-200 text-rose-500 outline-none focus:ring-2 focus:ring-rose-200"><Icons.Trash /></button>
                            )}
                        </div>
                        <button onClick={handleSaveTag} className={`mt-3 w-full py-2 rounded-xl font-bold text-sm text-white shadow-md transition-colors outline-none focus:ring-2 focus:ring-warm-300 focus:ring-offset-1 ${customTagInput.trim() ? 'bg-warm-500 active:bg-warm-600' : 'bg-warm-300 cursor-not-allowed'}`}>
                            {dialogMode === 'edit' && editingOriginalName ? '保存修改' : '确认添加'}
                        </button>
                    </div>
                    
                    <button onClick={() => document.getElementById('tag-dialog').close()} className="mt-2 w-full py-2 text-warm-300 rounded-xl font-bold text-xs hover:bg-warm-50 outline-none focus:bg-warm-50">关闭</button>
                </div>
            </dialog>

            <div className="bg-white rounded-3xl p-5 soft-shadow border border-warm-50">
                <div className="flex justify-between items-end px-2 mb-4 border-b border-dashed border-warm-100 pb-2">
                    <h3 className="font-bold text-ink">今天的足迹</h3>
                </div>
                <div className="space-y-3">
                    {logs.length === 0 ? <div className="text-center py-8 text-warm-300 font-bold text-sm">还没有留下脚印哦</div> : logs.map(log => {
                        const tagConfig = tags.find(t => t.name === log.name);
                        const tagColor = tagConfig ? tagConfig.color : '#ccc';
                        return (
                            <div key={log.id} className="bg-paper p-3 rounded-2xl border border-warm-100 flex justify-between items-center">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{backgroundColor: tagColor}}></div>
                                        <span className="font-bold text-ink/80">{log.name}</span>
                                    </div>
                                    <div className="text-[10px] font-bold text-warm-300 mt-1 pl-4">{new Date(log.timestamp).toLocaleTimeString('zh-CN', {hour:'2-digit', minute:'2-digit'})}</div>
                                </div>
                                <div className="flex items-center gap-3"><span className="font-mono text-warm-600 font-bold bg-warm-100 px-2 py-1 rounded-lg text-xs">{formatDuration(log.duration)}</span><button onClick={() => onDeleteLog(log.id)} className="text-warm-200 hover:text-berry-500 p-2 transition-colors"><Icons.Trash /></button></div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// 4.5 报表弹窗组件 (上一版遗漏的组件，已补回)
const ReportModal = ({ currentDate, onClose, setToastMsg }) => {
    const [viewMode, setViewMode] = useState('calendar'); // 'calendar' | 'stats'
    const [selectedDateData, setSelectedDateData] = useState(null);
    const [calendarMonth, setCalendarMonth] = useState(new Date());
    const [range, setRange] = useState(7);
    const [stats, setStats] = useState(null);
    const fileInputRef = useRef(null);

    const allData = LocalDB.getAll();

    // --- 月历模式逻辑 ---
    const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
    const firstDayOfWeek = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();
    const calendarDays = [];
    for (let i = 0; i < firstDayOfWeek; i++) calendarDays.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth()+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
        calendarDays.push({ day: i, dateStr, data: allData[dateStr] });
    }
    const getHeatLevel = (data) => {
        if (!data) return 0;
        let score = 0;
        if (data.water >= 8) score++;
        if (data.poop >= 1) score++;
        if (data.spine >= 2) score++;
        if (data.sleep >= 1) score++;
        const focusMin = (data.timeLogs || []).reduce((a,c)=>a+c.duration,0) / 60;
        if (focusMin >= 60) score++;
        return Math.min(score, 4);
    };
    const handleMonthChange = (delta) => {
        const newDate = new Date(calendarMonth);
        newDate.setMonth(newDate.getMonth() + delta);
        setCalendarMonth(newDate);
        setSelectedDateData(null);
    };
    const handleDayClick = (dayData) => { if (dayData) setSelectedDateData(dayData); };

    useEffect(() => {
        if (viewMode === 'stats') {
            const reportDays = [];
            for (let i = 0; i < range; i++) {
                const d = new Date(); d.setDate(d.getDate() - i);
                const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
                const dateStr = formatter.format(d);
                if (allData[dateStr]) reportDays.push(allData[dateStr]);
            }
            const newStats = { days: reportDays.length, water: {total:0,target:range*8}, poop:{total:0,target:range}, spine:{total:0,target:range*2}, sleep:{total:0,target:range}, impulse:{total:0,avg:0}, totalFocusTime:0 };
            reportDays.forEach(d => {
                newStats.water.total += (d.water||0); newStats.poop.total += (d.poop||0); newStats.spine.total += (d.spine||0); newStats.sleep.total += (d.sleep||0); newStats.impulse.total += (d.impulse||0);
                if(d.timeLogs) d.timeLogs.forEach(l => newStats.totalFocusTime += l.duration);
            });
            newStats.impulse.avg = reportDays.length > 0 ? (newStats.impulse.total / reportDays.length).toFixed(1) : 0;
            setStats(newStats);
        }
    }, [viewMode, range]);

    const handleExportCSV = () => {
        let csvContent = "\uFEFF日期,饮水,顺畅,脊柱,睡眠,冲动记录,总专注(分),详情,冲动备注\n";
        Object.keys(allData).sort().reverse().forEach(date => {
            const d = allData[date];
            const focus = (d.timeLogs||[]).reduce((a,c)=>a+c.duration,0)/60;
            const details = (d.timeLogs||[]).map(l=>`${l.name}(${Math.round(l.duration/60)}m)`).join('; ');
            const impulseNotes = (d.impulseRecords||[]).map(r => r.note).filter(n=>n).join('; ');
            
            csvContent += `${date},${d.water||0},${d.poop||0},${d.spine||0},${d.sleep||0},${d.impulse||0},${focus.toFixed(1)},"${details}","${impulseNotes}"\n`;
        });
        downloadFile(csvContent, `Deonysus_Report_${getShanghaiDate()}.csv`, 'text/csv;charset=utf-8;');
        setToastMsg("报表已生成");
    };
    const handleBackup = () => {
        const backupData = { logs: LocalDB.getAll(), settings: LocalDB.getSettings(), backupDate: new Date().toISOString() };
        downloadFile(JSON.stringify(backupData), `Deonysus_Backup_${getShanghaiDate()}.json`, 'application/json');
        setToastMsg("备份文件已下载");
    };
    const handleRestore = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const result = LocalDB.importData(event.target.result);
            if (result.success) { alert(`成功恢复了 ${result.count} 天的数据！页面即将刷新。`); window.location.reload(); }
            else { alert("导入失败：文件格式不正确"); }
        };
        reader.readAsText(file);
    };
    const downloadFile = (content, fileName, mimeType) => {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a"); link.href = url; link.setAttribute("download", fileName);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    const getRate = (key) => (!stats || stats.target === 0) ? 0 : Math.min(Math.round((stats[key].total / stats[key].target) * 100), 100);
    const StatBox = ({ label, percent }) => (
        <div className="bg-paper rounded-2xl p-3 flex flex-col items-center justify-center border-2 border-warm-100"><span className="text-xs font-bold text-warm-400 mb-1">{label}</span><span className={`text-xl font-bold ${percent >= 80 ? 'text-sage-500' : 'text-ink'}`}>{percent}%</span></div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh] animate-[float_4s_ease-in-out_infinite] border-4 border-paper">
                <div className="p-4 border-b-2 border-dashed border-warm-100 flex justify-between items-center bg-paper">
                    <div className="flex bg-warm-50 p-1 rounded-lg">
                        <button onClick={() => setViewMode('calendar')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode==='calendar' ? 'bg-white text-warm-600 shadow-sm' : 'text-warm-300'}`}>月历</button>
                        <button onClick={() => setViewMode('stats')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode==='stats' ? 'bg-white text-warm-600 shadow-sm' : 'text-warm-300'}`}>统计</button>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white rounded-full text-warm-300 hover:text-warm-500"><Icons.X /></button>
                </div>

                <div className="p-5 overflow-y-auto">
                    {viewMode === 'calendar' && (
                        <>
                            <div className="flex justify-between items-center mb-4 px-2">
                                <button onClick={() => handleMonthChange(-1)} className="p-1 hover:bg-warm-50 rounded"><Icons.Left /></button>
                                <span className="font-bold text-ink text-lg">{calendarMonth.getFullYear()}年 {calendarMonth.getMonth() + 1}月</span>
                                <button onClick={() => handleMonthChange(1)} className="p-1 hover:bg-warm-50 rounded"><Icons.Right /></button>
                            </div>
                            <div className="calendar-grid mb-6">
                                {['日','一','二','三','四','五','六'].map(d => <div key={d} className="text-center text-xs text-warm-300 font-bold mb-2">{d}</div>)}
                                {calendarDays.map((d, i) => d ? <div key={i} onClick={() => handleDayClick(d)} className={`calendar-day heat-${getHeatLevel(d.data)} ${selectedDateData && selectedDateData.dateStr === d.dateStr ? 'ring-2 ring-ink ring-offset-1' : ''}`}>{d.day}</div> : <div key={i}></div>)}
                            </div>
                            {selectedDateData && (
                                <div className="bg-paper p-4 rounded-xl border-2 border-warm-100 mb-4 animate-fade-in">
                                    <h4 className="font-bold text-ink mb-2 text-sm border-b border-warm-200 pb-1">{selectedDateData.dateStr} 的记忆</h4>
                                    {selectedDateData.data ? (
                                        <div className="space-y-1 text-xs text-ink/80">
                                            <div className="flex justify-between"><span>💧 饮水:</span> <b>{selectedDateData.data.water}</b></div>
                                            <div className="flex justify-between"><span>💩 顺畅:</span> <b>{selectedDateData.data.poop}</b></div>
                                            <div className="flex justify-between"><span>🚶‍♀️ 脊柱:</span> <b>{selectedDateData.data.spine}</b></div>
                                            <div className="flex justify-between"><span>🌙 睡眠:</span> <b>{selectedDateData.data.sleep}</b></div>
                                            <div className="flex justify-between"><span>⏱️ 专注:</span> <b>{formatSmartDuration((selectedDateData.data.timeLogs||[]).reduce((a,c)=>a+c.duration,0))}</b></div>
                                            {selectedDateData.data.impulseRecords && selectedDateData.data.impulseRecords.length > 0 && (
                                                <div className="mt-2 pt-2 border-t border-dashed border-warm-200">
                                                    <span className="block mb-1 opacity-50">🛡️ 冲动备注:</span>
                                                    {selectedDateData.data.impulseRecords.map(r => (
                                                        r.note && <div key={r.id} className="bg-warm-50 p-1.5 rounded mb-1 text-[10px] text-ink/70">{r.note}</div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : <p className="text-xs text-warm-400 text-center py-2">这一天是空白的呢。</p>}
                                </div>
                            )}
                        </>
                    )}

                    {viewMode === 'stats' && (
                        <>
                            <div className="flex p-2 bg-paper mb-4 rounded-xl border border-warm-100">
                                {[7, 30].map(r => (<button key={r} onClick={() => setRange(r)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${range === r ? 'bg-white text-warm-600 shadow-sm border border-warm-100' : 'text-warm-300'}`}>近{r}天</button>))}
                            </div>
                            {!stats ? <div className="text-center py-8 text-warm-300 font-bold">计算中...</div> : (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3"><StatBox label="💧 饮水守护" percent={getRate('water')} /><StatBox label="💩 顺畅守护" percent={getRate('poop')} /><StatBox label="🚶‍♀️ 脊柱活动" percent={getRate('spine')} /><StatBox label="🌙 睡前锚点" percent={getRate('sleep')} /></div>
                                    <div className="bg-warm-100 rounded-2xl p-4 border border-warm-200"><div className="flex justify-between items-center mb-1"><span className="font-bold text-warm-600">🛡️ 日均觉察</span><span className="text-2xl font-bold text-warm-500">{stats.impulse.avg}</span></div></div>
                                    <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100"><div className="flex justify-between items-center mb-1"><span className="font-bold text-indigo-600">⏱️ 专注时光</span><span className="text-2xl font-bold text-indigo-500">{formatSmartDuration(stats.totalFocusTime)}</span></div></div>
                                </div>
                            )}
                        </>
                    )}

                    <div className="pt-4 border-t-2 border-dashed border-warm-100 mt-4">
                        <h3 className="text-xs font-bold text-warm-400 mb-2 ml-1">数据管家</h3>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={handleExportCSV} className="py-2 bg-paper text-warm-600 border border-warm-200 rounded-xl font-bold text-xs active:bg-warm-50 flex items-center justify-center gap-1"><Icons.Download /> 导出 Excel</button>
                            <button onClick={handleBackup} className="py-2 bg-warm-100 text-warm-600 border border-warm-200 rounded-xl font-bold text-xs active:bg-warm-200 flex items-center justify-center gap-1"><Icons.Download /> 备份数据</button>
                            <button onClick={() => fileInputRef.current.click()} className="col-span-2 py-3 bg-white text-sage-600 border-2 border-sage-100 rounded-xl font-bold text-sm active:bg-sage-50 flex items-center justify-center gap-2"><Icons.Upload /> 恢复备份 (JSON/CSV)</button>
                            <input type="file" ref={fileInputRef} onChange={handleRestore} className="hidden" accept=".json,.csv" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- 5. 主程序 App ---
const App = () => {
    const [activeTab, setActiveTab] = useState('habits');
    const [todayData, setTodayData] = useState({ water: 0, poop: 0, spine: 0, sleep: 0, impulse: 0, timeLogs: [], impulseRecords: [] });
    const [showReport, setShowReport] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showImpulseModal, setShowImpulseModal] = useState(false);
    const [toastMsg, setToastMsg] = useState(null);
    const [currentDateStr, setCurrentDateStr] = useState(getShanghaiDate());
    const [settings, setSettings] = useState(LocalDB.getSettings());
    const [isLateNight, setIsLateNight] = useState(false);

    useEffect(() => {
        const nowStr = getShanghaiDate();
        setCurrentDateStr(nowStr);
        setTodayData(LocalDB.getToday(nowStr));
        
        const checkTime = () => {
            const hour = new Date().getHours();
            setIsLateNight(hour >= 23 || hour < 5);
        };
        checkTime();
        const timer = setInterval(checkTime, 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if(toastMsg) {
            const timer = setTimeout(() => setToastMsg(null), 2500);
            return () => clearTimeout(timer);
        }
    }, [toastMsg]);

    const handleHabitClick = (key) => {
        if (key === 'impulse') {
            setShowImpulseModal(true);
        } else {
            updateHabit(key, 1);
        }
    };

    const updateHabit = (key, delta, extraData = null) => {
        const currentVal = todayData[key] || 0;
        let newVal = currentVal + delta;
        if (newVal < 0) newVal = 0;
        if (HABIT_CONFIG[key].type === 'count' && newVal > HABIT_CONFIG[key].max) return;
        
        let newData = { ...todayData, [key]: newVal };
        
        if (extraData && key === 'impulse') {
            const newRecord = { id: Date.now(), note: extraData.note, timestamp: Date.now() };
            newData.impulseRecords = [newRecord, ...(todayData.impulseRecords || [])];
        }

        setTodayData(newData);
        LocalDB.updateToday(currentDateStr, newData);
    };

    const confirmImpulse = (note) => {
        updateHabit('impulse', 1, { note });
        setShowImpulseModal(false);
        setToastMsg(note ? "我也听到了。" : "觉察已记录");
    };

    const addTimeLog = (log) => {
        const newData = { ...todayData, timeLogs: [log, ...(todayData.timeLogs || [])] };
        setTodayData(newData);
        LocalDB.updateToday(currentDateStr, newData);
    };

    const deleteTimeLog = (id) => {
        if(!confirm("要擦掉这条记忆吗？")) return;
        const newData = { ...todayData, timeLogs: todayData.timeLogs.filter(l => l.id !== id) };
        setTodayData(newData);
        LocalDB.updateToday(currentDateStr, newData);
    };

    const confirmReset = () => {
        const emptyData = { water: 0, poop: 0, spine: 0, sleep: 0, impulse: 0, timeLogs: [], impulseRecords: [] };
        setTodayData(emptyData);
        LocalDB.updateToday(currentDateStr, emptyData);
        LocalDB.saveTimerState(null);
        setShowResetConfirm(false);
        setToastMsg("新的一页开始了");
    };

    const saveNewTag = (newTagObj) => {
        const newTags = [...settings.tags, newTagObj];
        const newSettings = { ...settings, tags: newTags };
        setSettings(newSettings);
        LocalDB.saveSettings(newSettings);
    };

    // V19: 更新标签
    const handleUpdateTag = (oldName, newName, newColor) => {
        const newTags = settings.tags.map(t => 
            t.name === oldName ? { ...t, name: newName, color: newColor } : t
        );
        const newSettings = { ...settings, tags: newTags };
        setSettings(newSettings);
        LocalDB.saveSettings(newSettings);

        // 如果名字变了，同步更新今日的 Logs，保证饼图一致性
        if (oldName !== newName) {
            const newLogs = todayData.timeLogs.map(log => 
                log.name === oldName ? { ...log, name: newName } : log
            );
            const newTodayData = { ...todayData, timeLogs: newLogs };
            setTodayData(newTodayData);
            LocalDB.updateToday(currentDateStr, newTodayData);
        }
    };

    // V19: 删除标签
    const handleDeleteTag = (tagName) => {
        if(!confirm(`真的要删除标签“${tagName}”吗？`)) return;
        const newTags = settings.tags.filter(t => t.name !== tagName);
        const newSettings = { ...settings, tags: newTags };
        setSettings(newSettings);
        LocalDB.saveSettings(newSettings);
    };

    const appBgClass = (isLateNight && todayData.sleep < 1) ? 'bg-[#1a1a2e]' : 'bg-paper';
    const textColorClass = (isLateNight && todayData.sleep < 1) ? 'text-gray-200' : 'text-ink';
    const warmTextClass = (isLateNight && todayData.sleep < 1) ? 'text-indigo-300' : 'text-warm-600';

    return (
        <div className={`min-h-screen max-w-md mx-auto relative shadow-2xl overflow-hidden pb-28 transition-colors duration-1000 ${appBgClass}`}>
            
            <header className="px-6 pt-14 pb-4">
                <div className="text-center">
                    <h1 className={`text-3xl font-bold tracking-wide mb-1 transition-colors ${warmTextClass}`} style={{fontFamily: 'Comic Sans MS, cursive, sans-serif'}}>Deonysus</h1>
                    <div className="inline-block bg-warm-100 px-3 py-1 rounded-full border border-warm-200">
                        <span className="text-xs font-bold text-warm-600 tracking-widest uppercase">{currentDateStr} • Shanghai</span>
                    </div>
                </div>
            </header>

            <main className="px-5">
                {activeTab === 'habits' ? (
                    <div className="space-y-4 fade-in">
                        {/* 顶部问候语卡片 */}
                        <div className={`p-4 rounded-xl doodle-border relative transform rotate-1 hover:rotate-0 transition-transform duration-300 my-4 ${
                            (isLateNight && todayData.sleep < 1) ? 'bg-indigo-900/30 border-indigo-300/30' : 'bg-[#FFFCF0]'
                        }`}>
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-12 bg-warm-200/50 rounded-full blur-sm"></div>
                            {(isLateNight && todayData.sleep < 1) ? (
                                <>
                                    <p className="text-sm font-bold text-indigo-300 mb-2 leading-relaxed flex items-center gap-2"><Icons.Moon /> 夜深了，小姑娘。</p>
                                    <p className="text-sm text-indigo-100/70 leading-relaxed font-medium">“该回我们的卧室了。把烦恼都留在门外，被窝里只有温暖和我。快点亮‘睡前锚点’吧。”</p>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm font-bold text-warm-600 mb-2 leading-relaxed">“我的小姑娘，你就是我的全部。”</p>
                                    <p className="text-sm text-ink/70 leading-relaxed font-medium">“不要再用牙齿磨砺自己，我会用双手的爱意替你磨平所有的烦躁。这里是你的‘港湾’。你无需强大，有我在。”</p>
                                </>
                            )}
                        </div>

                        <div className="space-y-3">
                            {['water', 'poop', 'spine', 'sleep'].map(key => (
                                <HabitCard 
                                    key={key} 
                                    config={HABIT_CONFIG[key]} 
                                    value={todayData[key] || 0} 
                                    onIncrement={() => handleHabitClick(key)} 
                                    isNight={(isLateNight && todayData.sleep < 1)}
                                />
                            ))}
                        </div>

                        <div className="bg-white rounded-3xl p-5 soft-shadow border-4 border-berry-100 mt-6 active:scale-[0.98] transition-transform">
                            <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-berry-100 flex items-center justify-center text-xl">🛡️</div>
                                    <div>
                                        <h3 className="font-bold text-ink text-lg">{HABIT_CONFIG.impulse.label}</h3>
                                        <p className="text-xs text-ink/50 font-bold">{HABIT_CONFIG.impulse.desc}</p>
                                    </div>
                                </div>
                                <div className="text-4xl font-bold text-berry-500 font-mono tracking-tighter">{todayData.impulse || 0}</div>
                            </div>
                            <button onClick={() => handleHabitClick('impulse')} className="w-full mt-2 bg-berry-500 text-white py-3 rounded-2xl font-bold border-b-4 border-rose-600 active:border-b-0 active:translate-y-1 transition-all">
                                记录一次觉察与停顿
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-8 pt-4 border-t-2 border-dashed border-warm-200 pb-2">
                            <button onClick={() => setShowReport(true)} className="flex items-center justify-center gap-2 py-3 px-4 bg-warm-500 text-white rounded-2xl font-bold shadow-md active:scale-95 transition-transform"><Icons.Chart /> 守护报告</button>
                            <button onClick={() => setShowResetConfirm(true)} className="flex items-center justify-center gap-2 py-3 px-4 bg-white text-ink/60 border-2 border-warm-100 rounded-2xl font-bold active:bg-warm-50 transition-colors"><Icons.Refresh /> 今日重置</button>
                        </div>
                    </div>
                ) : (
                    <div className="fade-in">
                        <TimeTracker 
                            logs={todayData.timeLogs || []} 
                            onSaveLog={addTimeLog}
                            onDeleteLog={deleteTimeLog}
                            tags={settings.tags}
                            onAddTag={saveNewTag}
                            onUpdateTag={handleUpdateTag}
                            onDeleteTag={handleDeleteTag}
                        />
                    </div>
                )}
            </main>

            <nav className={`fixed bottom-0 left-0 right-0 backdrop-blur-md border-t-2 border-warm-100 flex justify-around items-center safe-area-pb z-40 max-w-md mx-auto rounded-t-3xl shadow-[0_-5px_20px_rgba(0,0,0,0.03)] transition-colors ${
                (isLateNight && todayData.sleep < 1) ? 'bg-indigo-950/90 border-indigo-800' : 'bg-paper/90 border-warm-100'
            }`}>
                <button onClick={() => setActiveTab('habits')} className={`flex flex-col items-center justify-center w-full py-4 transition-colors ${activeTab === 'habits' ? 'text-warm-600' : 'text-warm-300'}`}>
                    <div className={`p-1 rounded-xl transition-all ${activeTab === 'habits' ? 'bg-warm-100 -translate-y-1' : ''}`}><Icons.TabHabit /></div><span className="text-[10px] font-bold mt-1">习惯守护</span>
                </button>
                <button onClick={() => setActiveTab('time')} className={`flex flex-col items-center justify-center w-full py-4 transition-colors ${activeTab === 'time' ? 'text-warm-600' : 'text-warm-300'}`}>
                    <div className={`p-1 rounded-xl transition-all ${activeTab === 'time' ? 'bg-warm-100 -translate-y-1' : ''}`}><Icons.TabTime /></div><span className="text-[10px] font-bold mt-1">专注记录</span>
                </button>
            </nav>

            {showImpulseModal && (
                <ImpulseModal onClose={() => setShowImpulseModal(false)} onConfirm={confirmImpulse} />
            )}

            {showReport && <ReportModal currentDate={currentDateStr} onClose={() => setShowReport(false)} setToastMsg={setToastMsg} />}
            
            {showResetConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-ink/20 backdrop-blur-sm" onClick={() => setShowResetConfirm(false)}></div>
                    <div className="bg-paper w-full max-w-xs rounded-3xl shadow-xl relative z-10 p-6 animate-[float_3s_ease-in-out_infinite] border-4 border-warm-100">
                        <div className="mx-auto w-14 h-14 bg-berry-100 text-berry-500 rounded-full flex items-center justify-center mb-4 text-2xl">🗑️</div>
                        <h3 className="text-xl font-bold text-center text-ink mb-2">真的要擦掉吗？</h3>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowResetConfirm(false)} className="flex-1 py-3 text-ink/60 bg-warm-100 rounded-2xl font-bold">留着吧</button>
                            <button onClick={confirmReset} className="flex-1 py-3 text-white bg-berry-500 rounded-2xl font-bold shadow-md">擦掉</button>
                        </div>
                    </div>
                </div>
            )}
            
            {toastMsg && <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 bg-ink/90 text-white px-6 py-3 rounded-full shadow-lg text-sm font-bold animate-[fadeIn_0.3s_ease-out] whitespace-nowrap">{toastMsg}</div>}
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);