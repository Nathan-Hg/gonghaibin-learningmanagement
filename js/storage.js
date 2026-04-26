/**
 * 数据存储模块 - 操作云端文件
 * 使用相对路径访问 学习管理系统/data/ 目录
 */
const Storage = {
    // 数据目录基础路径
    BASE_PATH: '../data/',
    
    // 缓存机制
    cache: {},
    cacheTime: {},
    CACHE_DURATION: 5000, // 缓存5秒

    /**
     * 通用请求封装
     */
    async request(path, options = {}) {
        const url = this.BASE_PATH + path;
        const defaultOptions = {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        try {
            const response = await fetch(url, { ...defaultOptions, ...options });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // 处理不同的HTTP方法
            if (options.method === 'DELETE') {
                return { success: true };
            }
            
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            
            return await response.text();
        } catch (error) {
            console.warn('Storage request warning:', error.message);
            // 返回空数据而不是抛出错误，保证页面正常运行
            return null;
        }
    },

    /**
     * 读取文件（带缓存）
     */
    async read(filePath, useCache = true) {
        const cacheKey = filePath;
        
        // 检查缓存
        if (useCache && this.cache[cacheKey] && this.cacheTime[cacheKey]) {
            if (Date.now() - this.cacheTime[cacheKey] < this.CACHE_DURATION) {
                return this.cache[cacheKey];
            }
        }
        
        const data = await this.request(filePath);
        
        // 缓存结果
        if (data !== null) {
            this.cache[cacheKey] = data;
            this.cacheTime[cacheKey] = Date.now();
        }
        
        return data;
    },

    /**
     * 写入文件
     */
    async write(filePath, data) {
        // 清除缓存
        delete this.cache[filePath];
        delete this.cacheTime[filePath];
        
        return await this.request(filePath, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    /**
     * 删除文件
     */
    async delete(filePath) {
        delete this.cache[filePath];
        delete this.cacheTime[filePath];
        
        return await this.request(filePath, {
            method: 'DELETE'
        });
    },

    /**
     * 清除所有缓存
     */
    clearCache() {
        this.cache = {};
        this.cacheTime = {};
    },

    // ============ 用户认证 ============

    /**
     * 检查登录状态
     */
    isLoggedIn() {
        return Utils.storage.get('isLoggedIn', false);
    },

    /**
     * 登录（模拟）
     */
    login(username) {
        Utils.storage.set('isLoggedIn', true);
        Utils.storage.set('username', username);
        Utils.storage.set('loginTime', new Date().toISOString());
    },

    /**
     * 登出
     */
    logout() {
        Utils.storage.remove('isLoggedIn');
        Utils.storage.remove('username');
        Utils.storage.remove('loginTime');
    },

    /**
     * 获取当前用户
     */
    getCurrentUser() {
        return {
            username: Utils.storage.get('username', 'Guest'),
            loginTime: Utils.storage.get('loginTime')
        };
    },

    // ============ 学习记录 ============

    /**
     * 获取指定日期的学习记录
     */
    async getRecord(date) {
        const filePath = `records/${date}.json`;
        const data = await this.read(filePath);
        return data || { date, records: [] };
    },

    /**
     * 保存学习记录
     */
    async saveRecord(date, record) {
        const existing = await this.getRecord(date);
        
        if (!record.id) {
            record.id = Utils.generateId('rec_');
        }
        record.created_at = new Date().toISOString();
        
        existing.records.push(record);
        
        // 同时更新书/课程索引
        await this.updateBookIndex(record);
        
        return await this.write(`records/${date}.json`, existing);
    },

    /**
     * 获取某月所有记录
     */
    async getMonthRecords(year, month) {
        const daysInMonth = Utils.getMonthDays(new Date(year, month - 1));
        const records = {};
        
        for (let day = 1; day <= daysInMonth; day++) {
            const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const data = await this.getRecord(date);
            if (data.records && data.records.length > 0) {
                records[date] = data.records;
            }
        }
        
        return records;
    },

    /**
     * 获取所有学习记录
     */
    async getAllRecords() {
        // 模拟数据，实际从云端获取
        return Utils.storage.get('allRecords', []);
    },

    // ============ 书/课程索引 ============

    /**
     * 获取书/课程索引
     */
    async getBookIndex() {
        const data = await this.read('books_courses.json');
        return data || { items: [] };
    },

    /**
     * 更新书/课程索引
     */
    async updateBookIndex(record) {
        const index = await this.getBookIndex();
        
        // 查找是否存在该书/课程
        const existing = index.items.find(item => item.name === record.content_name);
        
        if (existing) {
            existing.record_count = (existing.record_count || 0) + 1;
        } else {
            index.items.push({
                id: Utils.generateId('book_'),
                name: record.content_name,
                type: record.type,
                status: 'learning',
                record_count: 1,
                mastery_score: 0,
                exam_completion_rate: 0,
                completed_at: null
            });
        }
        
        await this.write('books_courses.json', index);
    },

    /**
     * 标记书/课程完成
     */
    async completeBook(bookId) {
        const index = await this.getBookIndex();
        const book = index.items.find(item => item.id === bookId);
        
        if (book) {
            book.status = 'completed';
            book.completed_at = new Date().toISOString();
            await this.write('books_courses.json', index);
        }
    },

    // ============ 考核记录 ============

    /**
     * 获取考核记录
     */
    async getExam(date) {
        const filePath = `exams/${date}.json`;
        const data = await this.read(filePath);
        return data || { date, exams: [] };
    },

    /**
     * 保存考核记录
     */
    async saveExam(date, exam) {
        if (!exam.id) {
            exam.id = Utils.generateId('exam_');
        }
        exam.created_at = new Date().toISOString();
        
        const existing = await this.getExam(date);
        existing.exams.push(exam);
        
        return await this.write(`exams/${date}.json`, existing);
    },

    /**
     * 获取今日考核
     */
    async getTodayExam() {
        const today = Utils.getToday();
        return await this.getExam(today);
    },

    // ============ 任务列表 ============

    /**
     * 获取任务列表
     */
    async getTasks() {
        // 模拟任务数据
        return Utils.storage.get('tasks', []);
    },

    /**
     * 添加任务
     */
    async addTask(task) {
        const tasks = await this.getTasks();
        task.id = Utils.generateId('task_');
        task.status = 'pending';
        task.created_at = new Date().toISOString();
        tasks.push(task);
        Utils.storage.set('tasks', tasks);
        return task;
    },
    
    /**
     * 保存任务（别名）
     */
    async saveTask(task) {
        return await this.addTask(task);
    },

    /**
     * 更新任务状态
     */
    async updateTask(taskId, updates) {
        const tasks = await this.getTasks();
        const index = tasks.findIndex(t => t.id === taskId);
        if (index !== -1) {
            tasks[index] = { ...tasks[index], ...updates };
            Utils.storage.set('tasks', tasks);
        }
    },

    /**
     * 完成或延期任务
     */
    async completeTask(taskId) {
        await this.updateTask(taskId, { 
            status: 'completed', 
            completed_at: new Date().toISOString() 
        });
    },

    async postponeTask(taskId, newDate) {
        await this.updateTask(taskId, { 
            status: 'postponed',
            postponed_to: newDate
        });
    },

    // ============ 知识库 ============

    /**
     * 获取知识库列表
     */
    async getKnowledgeList() {
        const data = await this.read('knowledge_list.json');
        return data || [];
    },

    /**
     * 获取知识库内容
     */
    async getKnowledge(bookName) {
        const filePath = `knowledge/${encodeURIComponent(bookName)}.md`;
        const content = await this.read(filePath);
        return content || '';
    },

    /**
     * 保存知识库内容
     */
    async saveKnowledge(bookName, content) {
        const filePath = `knowledge/${encodeURIComponent(bookName)}.md`;
        return await this.write(filePath, { content });
    },

    // ============ 统计数据 ============

    /**
     * 获取统计数据
     */
    async getStats() {
        // 模拟统计数据
        const savedStats = Utils.storage.get('stats', null);
        if (savedStats) return savedStats;
        
        // 返回默认统计
        return {
            totalHours: 0,
            totalContents: 0,
            completedRate: 0,
            monthlyData: []
        };
    },

    /**
     * 更新统计数据
     */
    async updateStats(stats) {
        Utils.storage.set('stats', stats);
    },

    // ============ 模拟数据生成 ============

    /**
     * 生成模拟学习记录
     */
    generateMockRecords(days = 30) {
        const records = [];
        const types = ['图书', '视频', '音频文稿'];
        const contents = [
            { name: '认知觉醒', desc: '第一章：大脑的原理' },
            { name: '认知觉醒', desc: '第二章：潜意识' },
            { name: '认知觉醒', desc: '第三章：元认知' },
            { name: 'Python编程', desc: '基础语法讲解' },
            { name: '英语听力', desc: 'VOA慢速英语' }
        ];
        
        for (let i = 0; i < days; i++) {
            const date = Utils.getRelativeDate(-i);
            const count = Math.floor(Math.random() * 4); // 0-3条记录
            
            for (let j = 0; j < count; j++) {
                const content = contents[Math.floor(Math.random() * contents.length)];
                records.push({
                    id: Utils.generateId('rec_'),
                    type: types[Math.floor(Math.random() * types.length)],
                    content_name: content.name,
                    content_desc: content.desc,
                    duration: Math.floor(Math.random() * 90) + 15,
                    created_at: new Date(date).toISOString()
                });
            }
        }
        
        return records;
    },

    /**
     * 生成模拟考核题目
     */
    generateMockExam() {
        return {
            id: Utils.generateId('exam_'),
            book_id: 'book_001',
            book_name: '认知觉醒',
            questions: [
                {
                    id: 'q_001',
                    type: '记忆',
                    question: '元认知的定义是什么？请用自己的话解释。',
                    source: '第三章：元认知'
                },
                {
                    id: 'q_002',
                    type: '理解',
                    question: '为什么说"觉醒是成长的起点"？结合书中内容谈谈你的理解。',
                    source: '第一章：大脑的原理'
                },
                {
                    id: 'q_003',
                    type: '记忆',
                    question: '大脑的三个分区是什么？它们各自的主要功能是什么？',
                    source: '第一章：大脑的原理'
                },
                {
                    id: 'q_004',
                    type: '理解',
                    question: '如何运用元认知能力来提升学习效率？请举例说明。',
                    source: '第三章：元认知'
                }
            ],
            created_at: new Date().toISOString()
        };
    }
};
