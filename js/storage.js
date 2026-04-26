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
        // 从localStorage读取真实题目
        const realQuestions = this.getQuestions();
        
        if (realQuestions && realQuestions.length > 0) {
            // 有真实题目，随机选择一个学习内容
            const contents = [...new Set(realQuestions.map(q => q.contentName))];
            const randomContent = contents[Math.floor(Math.random() * contents.length)];
            const filteredQuestions = realQuestions.filter(q => q.contentName === randomContent);
            
            return {
                id: Utils.generateId('exam_'),
                book_id: 'book_real',
                book_name: randomContent,
                questions: filteredQuestions.map((q, idx) => ({
                    id: `q_${idx + 1}_${Date.now()}`,
                    type: q.type === 'choice' ? '理解' : '应用',
                    question: q.question,
                    options: q.options,
                    answer: q.answer,
                    source: randomContent
                })),
                created_at: new Date().toISOString()
            };
        }
        
        // 没有真实题目，返回模拟题目
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
    },

    // ============ 题目生成系统 ============

    /**
     * 生成学习题目（调用DeepSeek）
     * @param {Object} content - 学习内容 {type, content_name, content_desc}
     * @returns {Array} 题目数组
     */
    async generateQuestions(content) {
        const DEEPSEEK_API_KEY = localStorage.getItem('deepseek_api_key') || 'sk-dda01297df2c4048b80578fe86e7946b';
        
        const prompt = `你是一位专业的教育测评专家。请根据以下学习内容生成题目。

学习类型：${content.type}
学习内容：${content.content_name}
内容概要：${content.content_desc || '暂无'}

用户背景：
- 教育行业16年从业经验
- 互联网产品经理6年
- 关注AI时代的教育变革

请生成以下题目：

【选择题2道】考察对核心概念的理解（不要考纯定义，考理解）
格式：
{"type":"choice","question":"题目","options":["A.xxx","B.xxx","C.xxx","D.xxx"],"answer":"B"}

【主观题2道】学以致用，结合当下热点（AI趋势、教育变革）、社会问题、个人成长、行业发展
格式：
{"type":"subjective","question":"题目"}

请用JSON数组返回：[题目1, 题目2, ...]
只返回JSON，不要其他内容。`;

        try {
            Utils.showToast('正在生成题目，请稍候...', 'default');
            
            const response = await fetch('https://api.deepseek.com/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [
                        { role: 'system', content: '你是一位专业的教育测评专家，擅长生成高质量的学习题目。' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 2000
                })
            });
            
            if (!response.ok) {
                throw new Error(`API调用失败: ${response.status}`);
            }
            
            const data = await response.json();
            const content_text = data.choices[0].message.content;
            
            // 解析JSON
            let questions = [];
            try {
                const jsonMatch = content_text.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    questions = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('无法解析题目');
                }
            } catch (e) {
                console.error('解析题目失败:', e);
                Utils.showToast('题目生成解析失败', 'error');
                return [];
            }
            
            // 为每道题添加关联的学习内容信息
            questions = questions.map((q, idx) => ({
                ...q,
                id: Utils.generateId('q_'),
                contentName: content.content_name,
                createdAt: new Date().toISOString()
            }));
            
            return questions;
            
        } catch (error) {
            console.error('生成题目失败:', error);
            Utils.showToast('生成题目失败：' + error.message, 'error');
            return [];
        }
    },

    /**
     * 获取所有题目
     */
    getQuestions() {
        return Utils.storage.get('learning_questions', []);
    },

    /**
     * 保存题目
     * @param {string} contentName - 学习内容名称
     * @param {Array} questions - 题目数组
     */
    saveQuestions(contentName, questions) {
        const allQuestions = this.getQuestions();
        
        // 标记关联的学习内容
        const newQuestions = questions.map(q => ({
            ...q,
            id: Utils.generateId('q_'),
            contentName: contentName,
            createdAt: new Date().toISOString()
        }));
        
        allQuestions.push(...newQuestions);
        Utils.storage.set('learning_questions', allQuestions);
        
        return newQuestions;
    },

    /**
     * 根据学习内容获取题目
     */
    getQuestionsByContent(contentName) {
        const allQuestions = this.getQuestions();
        return allQuestions.filter(q => q.contentName === contentName);
    },

    /**
     * 删除某学习内容的题目
     */
    deleteQuestionsByContent(contentName) {
        const allQuestions = this.getQuestions();
        const filtered = allQuestions.filter(q => q.contentName !== contentName);
        Utils.storage.set('learning_questions', filtered);
    },

    // ============ 学习内容查询（档案页用） ============

    /**
     * 获取某类型所有学习内容
     */
    async getLearningsByType(type) {
        const index = await this.getBookIndex();
        const typeMap = {
            'book': '图书',
            'video': '视频',
            'audio': '音频文稿'
        };
        const chineseType = typeMap[type] || type;
        return index.items.filter(l => l.type === chineseType);
    },

    /**
     * 获取某个学习内容
     */
    async getLearningById(id) {
        const index = await this.getBookIndex();
        return index.items.find(l => l.id === id);
    },

    /**
     * 获取某个学习内容（通过名称）
     */
    async getLearningByName(name) {
        const index = await this.getBookIndex();
        return index.items.find(l => l.name === name);
    },

    /**
     * 获取某学习内容的所有记录
     */
    async getRecordsByLearningName(contentName) {
        const records = [];
        // 遍历获取所有日期的记录
        const endDate = new Date();
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1); // 搜索过去一年的记录
        
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = Utils.formatDate(d, 'YYYY-MM-DD');
            const recordData = await this.getRecord(dateStr);
            if (recordData.records && recordData.records.length > 0) {
                const filtered = recordData.records.filter(r => r.content_name === contentName);
                records.push(...filtered.map(r => ({...r, date: dateStr})));
            }
        }
        return records;
    },

    /**
     * 获取某学习内容的答题记录
     */
    async getAnswersByLearningName(contentName) {
        const answers = Utils.storage.get('exam_results', []);
        return answers.filter(a => a.contentName === contentName);
    },

    /**
     * 获取某日期的学习记录
     */
    async getRecordsByDate(date) {
        const recordData = await this.getRecord(date);
        return recordData.records || [];
    },

    /**
     * 获取某日期的答题记录
     */
    async getAnswersByDate(date) {
        const answers = Utils.storage.get('exam_results', []);
        return answers.filter(a => a.date === date);
    },

    /**
     * 保存答题结果
     */
    saveExamResult(result) {
        const results = Utils.storage.get('exam_results', []);
        results.push(result);
        Utils.storage.set('exam_results', results);
    },

    /**
     * 获取所有答题结果
     */
    getExamResults() {
        return Utils.storage.get('exam_results', []);
    },

    // ============ 知识库相关 ============

    /**
     * 获取已完成的学习内容
     */
    async getCompletedLearnings(type) {
        const learnings = await this.getLearningsByType(type);
        return learnings.filter(l => l.status === 'completed');
    },

    /**
     * 获取所有学习内容
     */
    async getLearnings() {
        const index = await this.getBookIndex();
        return index.items || [];
    },

    /**
     * 获取某类型所有学习内容
     */
    async getLearningsByType(type) {
        const index = await this.getBookIndex();
        const typeMap = {
            'book': '图书',
            'video': '视频',
            'audio': '音频文稿'
        };
        const chineseType = typeMap[type] || type;
        return (index.items || []).filter(l => l.type === chineseType);
    },

    /**
     * 获取某个学习内容（通过ID）
     */
    async getLearningById(id) {
        const index = await this.getBookIndex();
        return (index.items || []).find(l => l.id === id);
    },

    /**
     * 更新学习内容状态
     */
    async updateLearningStatus(learningId, status) {
        const index = await this.getBookIndex();
        const learning = (index.items || []).find(l => l.id === learningId);
        if (learning) {
            learning.status = status;
            if (status === 'completed') {
                learning.completed_at = new Date().toISOString();
            }
            await this.write('books_courses.json', index);
        }
    },

    /**
     * 自动标记完成
     */
    async markLearningCompleted(learningId) {
        await this.updateLearningStatus(learningId, 'completed');
    }
};
// ============ 任务系统核心逻辑 ============

/**
 * 任务类型常量
 */
const TaskTypes = {
    DAILY: 'daily',      // 天任务
    WEEKLY: 'weekly'      // 周任务
};

/**
 * 任务状态常量
 */
const TaskStatus = {
    PENDING: 'pending',      // 待完成
    COMPLETED: 'completed',  // 已完成
    EXPIRED: 'expired'       // 已过期
};

/**
 * 任务系统核心模块
 */
const TaskSystem = {
    // 常量配置
    QUESTIONS_PER_CONTENT: 5,  // 每个学习内容5道题
    MAX_DAILY_MINUTES: 20,    // 天任务总时间≤20分钟
    EXPIRED_THRESHOLD_DAYS: 30, // 超过30天移到已过期统计区

    /**
     * 获取任务存储路径
     */
    getTaskFilePath(type) {
        return `tasks_${type}.json`;
    },

    // ============ 任务 CRUD 操作 ============

    /**
     * 获取所有任务（按类型分组）
     */
    async getAllTasks() {
        const dailyTasks = await this.readFromFile(this.getTaskFilePath('daily')) || [];
        const weeklyTasks = await this.readFromFile(this.getTaskFilePath('weekly')) || [];
        return { daily: dailyTasks, weekly: weeklyTasks };
    },

    /**
     * 从文件读取任务
     */
    async readFromFile(filePath) {
        const data = await Storage.request(filePath);
        return data || [];
    },

    /**
     * 保存任务到文件
     */
    async saveToFile(filePath, tasks) {
        return await Storage.request(filePath, {
            method: 'PUT',
            body: JSON.stringify(tasks)
        });
    },

    /**
     * 获取指定日期的天任务
     */
    async getDailyTask(date) {
        const tasks = await this.readFromFile(this.getTaskFilePath('daily'));
        return tasks.find(t => t.date === date) || null;
    },

    /**
     * 获取指定周的任务
     */
    async getWeeklyTask(weekStartDate) {
        const tasks = await this.readFromFile(this.getTaskFilePath('weekly'));
        return tasks.find(t => t.weekStartDate === weekStartDate) || null;
    },

    /**
     * 保存天任务
     */
    async saveDailyTask(task) {
        const filePath = this.getTaskFilePath('daily');
        let tasks = await this.readFromFile(filePath);
        
        // 检查是否已存在该日期任务
        const existingIndex = tasks.findIndex(t => t.date === task.date);
        if (existingIndex !== -1) {
            tasks[existingIndex] = task;
        } else {
            tasks.push(task);
        }
        
        return await this.saveToFile(filePath, tasks);
    },

    /**
     * 保存周任务
     */
    async saveWeeklyTask(task) {
        const filePath = this.getTaskFilePath('weekly');
        let tasks = await this.readFromFile(filePath);
        
        const existingIndex = tasks.findIndex(t => t.weekStartDate === task.weekStartDate);
        if (existingIndex !== -1) {
            tasks[existingIndex] = task;
        } else {
            tasks.push(task);
        }
        
        return await this.saveToFile(filePath, tasks);
    },

    /**
     * 更新任务状态
     */
    async updateTaskStatus(taskType, taskId, status) {
        const filePath = this.getTaskFilePath(taskType);
        let tasks = await this.readFromFile(filePath);
        
        const taskIndex = tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            tasks[taskIndex].status = status;
            tasks[taskIndex].completedAt = status === TaskStatus.COMPLETED ? new Date().toISOString() : null;
            await this.saveToFile(filePath, tasks);
            return tasks[taskIndex];
        }
        return null;
    },

    /**
     * 删除过期任务（超过30天）
     */
    async archiveExpiredTasks() {
        const now = new Date();
        const thresholdDate = new Date(now.getTime() - this.EXPIRED_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
        
        // 处理天任务
        await this.archiveExpiredFromFile('daily', thresholdDate);
        // 处理周任务
        await this.archiveExpiredFromFile('weekly', thresholdDate);
    },

    /**
     * 从指定文件归档过期任务
     */
    async archiveExpiredFromFile(taskType, thresholdDate) {
        const filePath = this.getTaskFilePath(taskType);
        const archiveFilePath = `archive_${filePath}`;
        let tasks = await this.readFromFile(filePath);
        
        const expiredTasks = [];
        const validTasks = [];
        
        for (const task of tasks) {
            const expireDate = new Date(task.expireAt);
            if (expireDate < thresholdDate) {
                expiredTasks.push({...task, status: TaskStatus.EXPIRED});
            } else {
                validTasks.push(task);
            }
        }
        
        if (expiredTasks.length > 0) {
            // 保存有效任务
            await this.saveToFile(filePath, validTasks);
            // 追加到归档
            const archivedTasks = await this.readFromFile(archiveFilePath) || [];
            await this.saveToFile(archiveFilePath, [...archivedTasks, ...expiredTasks]);
        }
    },

    /**
     * 获取已归档的过期任务
     */
    async getArchivedTasks() {
        const dailyArchived = await this.readFromFile('archive_tasks_daily.json') || [];
        const weeklyArchived = await this.readFromFile('archive_tasks_weekly.json') || [];
        return { daily: dailyArchived, weekly: weeklyArchived };
    },

    // ============ 任务自动生成 ============

    /**
     * 触发任务生成（录入学习内容后调用）
     */
    async triggerTaskGeneration() {
        const today = Utils.getToday();
        const weekStart = Utils.getWeekStartDate();
        
        // 生成/更新今日天任务
        await this.generateDailyTask(today);
        
        // 生成/更新本周周任务
        await this.generateWeeklyTask(weekStart);
    },

    /**
     * 生成天任务
     * - 包含当天所有学习内容
     * - 每个学习内容5道题
     * - 总时间≤20分钟
     */
    async generateDailyTask(date) {
        // 获取当天学习记录
        const recordData = await Storage.getRecord(date);
        const records = recordData.records || [];
        
        if (records.length === 0) {
            return null;
        }
        
        // 构建学习内容列表
        const contents = records.map(record => ({
            contentId: record.id,
            contentName: record.content_name,
            contentDesc: record.content_desc,
            type: record.type,
            questionCount: this.QUESTIONS_PER_CONTENT
        }));
        
        // 计算总预估时间（每题约1分钟，每内容额外1分钟）
        const totalMinutes = contents.length * (this.QUESTIONS_PER_CONTENT + 1);
        
        // 检查总时间是否超限
        let adjustedContents = contents;
        if (totalMinutes > this.MAX_DAILY_MINUTES) {
            // 减少题目数量以满足时间限制
            const maxQuestions = Math.floor(this.MAX_DAILY_MINUTES / contents.length) - 1;
            adjustedContents = contents.map(c => ({
                ...c,
                questionCount: Math.min(c.questionCount, Math.max(3, maxQuestions))
            }));
        }
        
        // 计算过期时间（次日）
        const expireDate = new Date(date);
        expireDate.setDate(expireDate.getDate() + 1);
        const expireAt = expireDate.toISOString();
        
        // 构建任务
        const task = {
            id: Utils.generateId('daily_'),
            type: TaskTypes.DAILY,
            date: date,
            name: `${Utils.formatDateChinese(date)} 学习任务`,
            contents: adjustedContents,
            status: TaskStatus.PENDING,
            totalQuestions: adjustedContents.reduce((sum, c) => sum + c.questionCount, 0),
            estimatedMinutes: adjustedContents.reduce((sum, c) => sum + c.questionCount + 1, 0),
            createdAt: new Date().toISOString(),
            expireAt: expireAt
        };
        
        await this.saveDailyTask(task);
        return task;
    },

    /**
     * 生成周任务
     * - 本周学习汇总
     * - 综合题目
     */
    async generateWeeklyTask(weekStartDate) {
        // 获取本周所有学习记录
        const weekRecords = await this.getWeekRecords(weekStartDate);
        
        if (weekRecords.length === 0) {
            return null;
        }
        
        // 按内容分组汇总
        const contentSummary = {};
        for (const record of weekRecords) {
            const key = record.content_name;
            if (!contentSummary[key]) {
                contentSummary[key] = {
                    contentName: record.content_name,
                    type: record.type,
                    recordCount: 0,
                    totalDuration: 0,
                    descriptions: []
                };
            }
            contentSummary[key].recordCount++;
            contentSummary[key].totalDuration += record.duration || 0;
            if (record.content_desc && !contentSummary[key].descriptions.includes(record.content_desc)) {
                contentSummary[key].descriptions.push(record.content_desc);
            }
        }
        
        // 计算过期时间（下周）
        const expireDate = new Date(weekStartDate);
        expireDate.setDate(expireDate.getDate() + 7);
        const expireAt = expireDate.toISOString();
        
        // 构建周任务
        const task = {
            id: Utils.generateId('weekly_'),
            type: TaskTypes.WEEKLY,
            weekStartDate: weekStartDate,
            weekEndDate: Utils.getWeekEndDate(weekStartDate),
            name: `${Utils.formatDateChinese(weekStartDate)} 周学习总结`,
            contents: Object.values(contentSummary),
            status: TaskStatus.PENDING,
            totalRecords: weekRecords.length,
            totalContents: Object.keys(contentSummary).length,
            totalMinutes: Object.values(contentSummary).reduce((sum, c) => sum + c.totalDuration, 0),
            createdAt: new Date().toISOString(),
            expireAt: expireAt
        };
        
        await this.saveWeeklyTask(task);
        return task;
    },

    /**
     * 获取指定周的所有学习记录
     */
    async getWeekRecords(weekStartDate) {
        const records = [];
        const start = new Date(weekStartDate);
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(start);
            date.setDate(date.getDate() + i);
            const dateStr = Utils.formatDate(date, 'YYYY-MM-DD');
            const recordData = await Storage.getRecord(dateStr);
            if (recordData.records && recordData.records.length > 0) {
                records.push(...recordData.records);
            }
        }
        
        return records;
    },

    /**
     * 获取今日所有待完成任务
     */
    async getPendingTasks() {
        const today = Utils.getToday();
        const weekStart = Utils.getWeekStartDate();
        
        const dailyTask = await this.getDailyTask(today);
        const weeklyTask = await this.getWeeklyTask(weekStart);
        
        const pending = [];
        
        if (dailyTask && dailyTask.status === TaskStatus.PENDING) {
            pending.push(dailyTask);
        }
        
        if (weeklyTask && weeklyTask.status === TaskStatus.PENDING) {
            pending.push(weeklyTask);
        }
        
        return pending;
    },

    /**
     * 获取已过期但未归档的任务
     */
    async getExpiredTasks() {
        const now = new Date();
        const allTasks = await this.getAllTasks();
        
        const expired = [];
        
        for (const task of [...allTasks.daily, ...allTasks.weekly]) {
            if (task.status !== TaskStatus.COMPLETED) {
                const expireDate = new Date(task.expireAt);
                if (expireDate < now) {
                    task.status = TaskStatus.EXPIRED;
                    expired.push(task);
                }
            }
        }
        
        return expired;
    },

    /**
     * 完成任务（做题）
     */
    async completeTask(taskType, taskId) {
        return await this.updateTaskStatus(taskType, taskId, TaskStatus.COMPLETED);
    },

    /**
     * 延期任务
     */
    async postponeTask(taskType, taskId, days = 1) {
        const filePath = this.getTaskFilePath(taskType);
        let tasks = await this.readFromFile(filePath);
        
        const taskIndex = tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            const task = tasks[taskIndex];
            const newExpireDate = new Date(task.expireAt);
            newExpireDate.setDate(newExpireDate.getDate() + days);
            task.expireAt = newExpireDate.toISOString();
            task.status = TaskStatus.PENDING;
            await this.saveToFile(filePath, tasks);
            return task;
        }
        return null;
    },
    
    // ============ 题目生成队列 ============
    
    /**
     * 获取待生成题目的队列
     */
    getPendingQueue() {
        const queue = localStorage.getItem('pending_questions_queue');
        return queue ? JSON.parse(queue) : [];
    },
    
    /**
     * 添加到待生成队列（第二天上午生成）
     */
    addToPendingQueue(record) {
        const queue = this.getPendingQueue();
        queue.push({
            ...record,
            addedAt: new Date().toISOString(),
            date: Utils.getToday()
        });
        localStorage.setItem('pending_questions_queue', JSON.stringify(queue));
    }
};
