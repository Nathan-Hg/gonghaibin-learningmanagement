/**
 * 路由系统模块
 */
const Router = {
    // 路由配置
    routes: {
        'home': { title: '首页', template: 'home.html' },
        'record': { title: '录入', template: 'record.html' },
        'calendar': { title: '日历', template: 'calendar.html' },
        'task': { title: '任务', template: 'task.html' },
        'exam': { title: '答题', template: 'exam.html' },
        'archive': { title: '学习档案', template: 'archive.html' },
        'knowledge': { title: '知识库', template: 'knowledge.html' },
        'stats': { title: '统计', template: 'stats.html' }
    },

    // 当前路由
    currentRoute: null,

    /**
     * 初始化路由
     */
    init() {
        // 监听hash变化
        window.addEventListener('hashchange', () => this.handleRoute());
        
        // 初始路由
        this.handleRoute();
    },

    /**
     * 处理路由变化
     */
    async handleRoute() {
        // 获取hash
        let hash = window.location.hash.slice(1) || 'home';
        
        // 处理子路由（如 exam?id=xxx）
        const [route, query] = hash.split('?');
        
        // 检查登录状态 - index路由用于触发登出，不需要登录状态检查
        if (route === 'index') {
            // index路由只是触发登出，不需要加载页面
            return;
        }
        
        if (!Storage.isLoggedIn()) {
            // 未登录，跳转到登录页
            window.location.hash = '';
            return;
        }

        this.currentRoute = route;
        
        // 更新页面标题
        const routeInfo = this.routes[route] || this.routes['home'];
        document.title = routeInfo.title + ' - 主子的学习管理平台';
        
        // 加载页面模板
        await this.loadPage(route);
        
        // 更新导航状态
        this.updateNavState(route);
    },

    /**
     * 加载页面
     */
    async loadPage(route) {
        // 尝试多个容器ID
        let container = document.getElementById('main-content') || 
                        document.getElementById('app-container') ||
                        document.querySelector('.app-container') ||
                        document.body;
        
        // 如果容器就是body，清空并重建
        if (container === document.body) {
            container.innerHTML = '';
            container.style.background = '#F8FAFC';
        }
        
        try {
            // 构建完整页面HTML
            const pageHtml = await this.buildPage(route);
            container.innerHTML = pageHtml;
            
            // 执行页面初始化脚本
            this.executePageScript(route);
            
            // 触发页面加载完成事件
            window.dispatchEvent(new CustomEvent('pageLoaded', { detail: { route } }));
        } catch (error) {
            console.error('Load page error:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                    </div>
                    <div class="empty-title">页面加载失败</div>
                    <div class="empty-desc">请刷新页面重试</div>
                </div>
            `;
        }
    },

    /**
     * 构建完整页面HTML
     */
    async buildPage(route) {
        // 先获取badge HTML（异步）
        const taskBadgeHtml = await this.getTaskBadgeHTML();
        
        // 公共布局
        const layout = `
            <header class="app-header">
                <div class="header-left">
                    ${route !== 'home' ? `
                        <button class="back-btn" onclick="Router.go('home')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="15 18 9 12 15 6"></polyline>
                            </svg>
                        </button>
                    ` : ''}
                    <img src="assets/coze-logo.svg" alt="扣子" style="width: 32px; height: 36px;">
                    <span class="header-title">${this.routes[route]?.title || '学习管理'}</span>
                </div>
                <div class="header-right">
                    <div class="user-info">
                        <div class="user-avatar">N</div>
                    </div>
                </div>
            </header>
            
            <!-- 移动端底部导航 -->
            <nav class="bottom-nav">
                <a class="nav-item ${route === 'home' ? 'active' : ''}" href="#home">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                    <span>首页</span>
                </a>
                <a class="nav-item ${route === 'record' ? 'active' : ''}" href="#record">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    <span>录入</span>
                </a>
                <a class="nav-item ${route === 'task' ? 'active' : ''}" href="#task" style="position: relative;">
                    ${taskBadgeHtml}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    <span>任务</span>
                </a>
                <a class="nav-item ${route === 'archive' ? 'active' : ''}" href="#archive">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <span>档案</span>
                </a>
                <a class="nav-item ${route === 'knowledge' ? 'active' : ''}" href="#knowledge">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                    </svg>
                    <span>知识库</span>
                </a>
                <a class="nav-item ${route === 'stats' ? 'active' : ''}" href="#stats">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="20" x2="18" y2="10"></line>
                        <line x1="12" y1="20" x2="12" y2="4"></line>
                        <line x1="6" y1="20" x2="6" y2="14"></line>
                    </svg>
                    <span>统计</span>
                </a>
            </nav>
            
            <!-- PC端侧边导航 -->
            <nav class="sidebar-nav">
                <a class="nav-item ${route === 'home' ? 'active' : ''}" href="#home">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    </svg>
                    首页
                </a>
                <a class="nav-item ${route === 'record' ? 'active' : ''}" href="#record">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    录入
                </a>
                <a class="nav-item ${route === 'task' ? 'active' : ''}" href="#task" style="position: relative;">
                    ${taskBadgeHtml}
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    任务
                </a>

                <a class="nav-item ${route === 'archive' ? 'active' : ''}" href="#archive">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                    学习档案
                </a>
                <a class="nav-item ${route === 'knowledge' ? 'active' : ''}" href="#knowledge">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                    </svg>
                    知识库
                </a>
                <a class="nav-item ${route === 'stats' ? 'active' : ''}" href="#stats">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="20" x2="18" y2="10"></line>
                        <line x1="12" y1="20" x2="12" y2="4"></line>
                        <line x1="6" y1="20" x2="6" y2="14"></line>
                    </svg>
                    统计
                </a>
            </nav>
            
            <!-- 主内容区 -->
            <main class="app-main" id="page-content">
                ${await this.getPageContent(route)}
            </main>
        `;
        
        return layout;
    },

    /**
     * 获取页面内容
     */
    async getPageContent(route) {
        switch (route) {
            case 'home': return this.getHomeContent();
            case 'record': return this.getRecordContent();
            case 'calendar': return this.getCalendarContent();
            case 'task': return this.getTaskContent();
            case 'exam': return this.getExamContent();
            case 'archive': return this.getArchiveContent();
            case 'knowledge': return this.getKnowledgeContent();
            case 'stats': return this.getStatsContent();
            default: return '<div class="empty-state"><div class="empty-title">页面不存在</div></div>';
        }
    },

    /**
     * 首页内容
     */
    getHomeContent() {
        const today = Utils.getToday();
        const date = new Date();
        const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        
        return `
            <div class="page-header">
                <div class="page-title">你好，${Storage.getCurrentUser().username}</div>
                <div class="page-subtitle">${date.getMonth() + 1}月${date.getDate()}日 ${weekDays[date.getDay()]} · 每天进步一点点</div>
            </div>
            
            <!-- 日历组件 -->
            <div class="calendar mb-6" id="home-calendar">
                <div class="calendar-header">
                    <div class="calendar-title" id="calendar-title">加载中...</div>
                    <div class="calendar-nav">
                        <button onclick="App.prevMonth()">‹</button>
                        <button onclick="App.nextMonth()">›</button>
                    </div>
                </div>
                <div class="calendar-weekdays">
                    <div class="calendar-weekday">日</div>
                    <div class="calendar-weekday">一</div>
                    <div class="calendar-weekday">二</div>
                    <div class="calendar-weekday">三</div>
                    <div class="calendar-weekday">四</div>
                    <div class="calendar-weekday">五</div>
                    <div class="calendar-weekday">六</div>
                </div>
                <div class="calendar-days" id="calendar-days"></div>
            </div>
        `;
    },

    /**
     * 录入页内容
     */
    getRecordContent() {
        return `
            <div class="page-header">
                <div class="page-title">录入学习</div>
                <div class="page-subtitle">记录今天的学习内容</div>
            </div>
            
            <!-- 手动录入表单 -->
            <div id="manual-form">
                <div class="card">
                    <!-- 语音录入按钮 -->
                    <div class="voice-input-section mb-4" style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-secondary); border-radius: var(--radius-md);">
                        <button class="btn btn-outline" onclick="App.toggleVoiceInput()">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                                <line x1="12" y1="19" x2="12" y2="23"></line>
                                <line x1="8" y1="23" x2="16" y2="23"></line>
                            </svg>
                            语音录入
                        </button>
                        <span id="voice-status" class="text-muted" style="font-size: 13px; display: none;">
                            🎤 正在录音...
                        </span>
                        <span id="voice-tip" class="text-muted" style="font-size: 13px;">
                            点击麦克风开始说话，自动识别学习内容
                        </span>
                    </div>
                    
                    <!-- 语音转文字结果显示 -->
                    <div id="voice-result" class="voice-result mb-4" style="display: none; padding: 12px; background: var(--bg-secondary); border-radius: var(--radius-md);">
                        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">识别结果：</div>
                        <div id="voice-result-text" style="font-size: 14px; color: var(--text-secondary);"></div>
                    </div>
                    
                    <div class="form-item">
                        <label class="form-label">学习类型</label>
                        <select class="form-input form-select" id="record-type">
                            <option value="图书">📚 图书</option>
                            <option value="视频">🎬 视频</option>
                            <option value="音频文稿">🎧 音频文稿</option>
                        </select>
                    </div>
                    
                    <div class="form-item">
                        <label class="form-label">内容名称</label>
                        <input type="text" class="form-input" id="content-name" placeholder="请输入书名或课程名">
                    </div>
                    
                    <div class="form-item">
                        <label class="form-label">内容描述</label>
                        <textarea class="form-input form-textarea" id="content-desc" placeholder="请输入学习章节或内容摘要"></textarea>
                    </div>
                    
                    <div class="form-item">
                        <label class="form-label">学习时长（分钟）</label>
                        <input type="number" class="form-input" id="duration" placeholder="请输入学习时长" min="1">
                    </div>
                    
                    <button class="btn btn-primary btn-lg" style="width: 100%;" onclick="App.submitRecord()">
                        提交记录
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * 日历页内容
     */
    getCalendarContent() {
        return `
            <div class="page-header">
                <div class="page-title">学习日历</div>
                <div class="page-subtitle">查看历史学习记录</div>
            </div>
            
            <div class="calendar" id="full-calendar">
                <div class="calendar-header">
                    <div class="calendar-title" id="calendar-title">加载中...</div>
                    <div class="calendar-nav">
                        <button onclick="App.prevMonth()">‹</button>
                        <button onclick="App.nextMonth()">›</button>
                    </div>
                </div>
                <div class="calendar-weekdays">
                    <div class="calendar-weekday">日</div>
                    <div class="calendar-weekday">一</div>
                    <div class="calendar-weekday">二</div>
                    <div class="calendar-weekday">三</div>
                    <div class="calendar-weekday">四</div>
                    <div class="calendar-weekday">五</div>
                    <div class="calendar-weekday">六</div>
                </div>
                <div class="calendar-days" id="calendar-days"></div>
            </div>
            
            <!-- 选中日期详情 -->
            <div class="card mt-4" id="day-detail" style="display: none;">
                <div class="card-header">
                    <div class="card-title" id="detail-date">选择日期</div>
                </div>
                <div id="detail-records"></div>
            </div>
        `;
    },

    /**
     * 任务页内容
     */
    getTaskContent() {
        return `
            <div class="page-header">
                <div class="page-title">任务</div>
            </div>
            
            <div class="tabs mb-4">
                <button class="tab active" onclick="App.switchTaskType('daily')">日任务</button>
                <button class="tab" onclick="App.switchTaskType('weekly')">周任务</button>
            </div>
            
            <div id="task-list">
                <div class="loading"><div class="spinner"></div></div>
            </div>
            
            <!-- 已过期任务统计 -->
            <div class="expired-tasks-section" id="expired-tasks-section" style="display: none;">
                <div class="expired-title">已过期任务</div>
                <div class="expired-stats">
                    <span class="expired-item">周任务 <span class="count" id="expired-weekly-count">0/0</span></span>
                    <span class="expired-item">日任务 <span class="count" id="expired-daily-count">0/0</span></span>
                </div>
            </div>
        `;
    },

    /**
     * 答题页内容
     */
    getExamContent() {
        return `
            <div class="page-header">
                <div class="page-title">答题考核</div>
                <div class="page-subtitle">检验学习效果，巩固记忆</div>
            </div>
            
            <div id="exam-content">
                <div class="loading"><div class="spinner"></div></div>
            </div>
        `;
    },

    /**
     * 学习档案页内容
     */
    getArchiveContent() {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        
        // 生成年份选项（当前年前后5年）
        let yearOptions = '';
        for (let y = currentYear - 5; y <= currentYear; y++) {
            yearOptions += `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}年</option>`;
        }
        
        // 生成月份选项
        let monthOptions = '';
        for (let m = 1; m <= 12; m++) {
            monthOptions += `<option value="${m}" ${m === currentMonth ? 'selected' : ''}>${m}月</option>`;
        }
        
        return `
            <div class="page-header">
                <div class="page-title">学习档案</div>
                <div class="page-subtitle">回顾学习历程，见证成长</div>
            </div>
            
            <div class="tabs archive-tabs">
                <button class="tab active" data-tab="by-content" onclick="App.switchArchiveTab('by-content')">按内容查看</button>
                <button class="tab" data-tab="by-date" onclick="App.switchArchiveTab('by-date')">按日期查看</button>
            </div>
            
            <div id="archive-content">
                <div class="loading"><div class="spinner"></div></div>
            </div>
            
            <!-- 按日期查看：年月日选择器 -->
            <div id="date-selector" class="date-selector" style="display: none;">
                <div class="date-picker-row">
                    <select id="year-select" onchange="App.updateArchiveCalendar()">
                        ${yearOptions}
                    </select>
                    <select id="month-select" onchange="App.updateArchiveCalendar()">
                        ${monthOptions}
                    </select>
                    <select id="day-select" onchange="App.showArchiveDateRecords()">
                        <!-- 日期选项由JS动态生成 -->
                    </select>
                </div>
                
                <div class="calendar-picker" id="archive-calendar">
                    <!-- 月历 -->
                </div>
                
                <div id="archive-date-records">
                    <!-- 当天记录 -->
                </div>
            </div>
        `;
    },

    /**
     * 知识库页内容
     */
    getKnowledgeContent() {
        return `
            <div class="page-header">
                <div class="page-title">知识库</div>
                <div class="page-subtitle">已完成的学习内容</div>
            </div>
            
            <div class="tabs archive-tabs mb-4">
                <button class="tab active" onclick="App.switchKnowledgeType('book')">📚 图书</button>
                <button class="tab" onclick="App.switchKnowledgeType('video')">🎬 视频</button>
                <button class="tab" onclick="App.switchKnowledgeType('audio')">🎧 音频</button>
            </div>
            
            <div id="knowledge-list">
                <div class="loading"><div class="spinner"></div></div>
            </div>
        `;
    },

    /**
     * 统计页内容
     */
    getStatsContent() {
        return `
            <div class="page-header">
                <div class="page-title">学习统计</div>
            </div>
            
            <div class="tabs mb-4">
                <button class="tab active" onclick="App.switchStatsMode('content')">按内容统计</button>
                <button class="tab" onclick="App.switchStatsMode('time')">按时间统计</button>
            </div>
            
            <div id="stats-content">
                <div class="loading"><div class="spinner"></div></div>
            </div>
        `;
    },

    /**
     * 执行页面脚本
     */
    executePageScript(route) {
        // Tab切换
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', function() {
                const parent = this.closest('.tabs');
                parent.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                
                const tabName = this.dataset.tab;
                if (tabName === 'manual') {
                    document.getElementById('manual-form').style.display = 'block';
                    document.getElementById('voice-form').style.display = 'none';
                } else if (tabName === 'voice') {
                    document.getElementById('manual-form').style.display = 'none';
                    document.getElementById('voice-form').style.display = 'block';
                }
            });
        });
        
        // 加载页面特定数据
        if (typeof App !== 'undefined' && App.loadPageData) {
            App.loadPageData(route);
        }
    },

    /**
     * 更新导航状态
     */
    updateNavState(route) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('href') === '#' + route) {
                item.classList.add('active');
            }
        });
    },

    /**
     * 导航到指定页面
     */
    go(route) {
        window.location.hash = route;
    },

    /**
     * 获取过去30天内未完成的任务数
     */
    async getUncompletedTasksLast30Days() {
        const tasks = await Storage.getTasks();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        return tasks.filter(task => {
            // 未完成的任务（pending或postponed状态）
            if (task.status === 'completed') return false;
            
            // 检查任务是否在30天内
            const taskDate = new Date(task.due_date || task.created_at);
            return taskDate >= thirtyDaysAgo;
        }).length;
    },

    /**
     * 获取任务Tab气泡HTML
     */
    async getTaskBadgeHTML() {
        const count = await this.getUncompletedTasksLast30Days();
        if (count > 0) {
            return `<span class="nav-badge">${count > 99 ? '99+' : count}</span>`;
        }
        return '';
    }
};
