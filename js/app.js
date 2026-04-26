/**
 * 主应用逻辑模块
 */
const App = {
    // 当前月份
    currentMonth: new Date(),
    
    // 选中的日期
    selectedDate: null,
    
    // 录音状态
    isRecording: false,
    mediaRecorder: null,
    audioChunks: [],
    
    // 语音识别状态
    voiceRecognition: null,
    voiceTranscript: '',
    
    /**
     * 初始化应用
     */
    init() {
        // 初始化路由
        Router.init();
        
        console.log('App initialized');
    },
    
    /**
     * 加载页面数据
     */
    async loadPageData(route) {
        switch (route) {
            case 'home':
            case 'calendar':
                await this.renderCalendar();
                break;
            case 'task':
                await this.loadTasks();
                break;
            case 'exam':
                await this.loadExam();
                break;
            case 'archive':
                await this.loadArchive();
                break;
            case 'knowledge':
                await this.loadKnowledge();
                break;
            case 'stats':
                await this.loadStats();
                break;
        }
    },
    
    // ============ 日历相关 ============
    
    /**
     * 渲染日历
     */
    async renderCalendar() {
        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth() + 1;
        
        // 更新标题
        const titleEl = document.getElementById('calendar-title');
        if (titleEl) {
            titleEl.textContent = `${year}年${month}月`;
        }
        
        // 获取月份记录数据
        const records = await this.getMonthRecordCounts(year, month);
        
        // 计算日历数据
        const firstDay = Utils.getMonthFirstDay(this.currentMonth);
        const lastDay = Utils.getMonthLastDay(this.currentMonth);
        const startDay = firstDay.getDay();
        const daysInMonth = lastDay.getDate();
        
        // 生成日历HTML
        const container = document.getElementById('calendar-days');
        if (!container) return;
        
        let html = '';
        
        // 上月空白
        const prevMonth = new Date(year, month - 2, 1);
        const prevMonthDays = Utils.getMonthDays(prevMonth);
        for (let i = startDay - 1; i >= 0; i--) {
            const day = prevMonthDays - i;
            html += `<div class="calendar-day other-month">${day}</div>`;
        }
        
        // 当月日期
        const today = Utils.getToday();
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const recordCount = records[dateStr] || 0;
            const level = Utils.getIntensityLevel(recordCount);
            const isToday = dateStr === today;
            
            let classes = 'calendar-day';
            if (isToday) classes += ' today';
            if (level > 0) classes += ` level-${level}`;
            
            html += `
                <div class="${classes}" data-date="${dateStr}" onclick="App.selectDate('${dateStr}')">
                    ${day}
                </div>
            `;
        }
        
        // 下月空白
        const totalCells = startDay + daysInMonth;
        const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
        for (let i = 1; i <= remaining; i++) {
            html += `<div class="calendar-day other-month">${i}</div>`;
        }
        
        container.innerHTML = html;
    },
    
    /**
     * 获取月份记录数量
     */
    async getMonthRecordCounts(year, month) {
        // 从存储获取
        const key = `records_${year}_${month}`;
        let records = Utils.storage.get(key, null);
        
        if (!records) {
            records = {};
        }
        
        // 转换为每天的学习类型数量（去重）
        const typeCountMap = {};
        for (const dateStr in records) {
            const dayRecords = records[dateStr] || [];
            if (dayRecords.length > 0) {
                // 获取当天不同学习类型的数量
                const types = new Set(dayRecords.map(r => r.type));
                typeCountMap[dateStr] = types.size;
            }
        }
        
        return typeCountMap;
    },
    
    /**
     * 上个月
     */
    prevMonth() {
        this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
        this.renderCalendar();
    },
    
    /**
     * 下个月
     */
    nextMonth() {
        this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
        this.renderCalendar();
    },
    
    /**
     * 选择日期
     */
    async selectDate(dateStr) {
        this.selectedDate = dateStr;
        
        // 更新选中状态
        document.querySelectorAll('.calendar-day').forEach(el => {
            el.classList.remove('selected');
        });
        const selected = document.querySelector(`.calendar-day[data-date="${dateStr}"]`);
        if (selected) {
            selected.classList.add('selected');
        }
        
        // 如果是日历页，显示详情
        const detailEl = document.getElementById('day-detail');
        if (detailEl) {
            detailEl.style.display = 'block';
            document.getElementById('detail-date').textContent = dateStr;
            
            const recordData = await Storage.getRecord(dateStr);
            const records = recordData.records || [];
            
            if (records.length === 0) {
                document.getElementById('detail-records').innerHTML = `
                    <div class="empty-state" style="padding: 30px;">
                        <div class="empty-desc">暂无学习记录</div>
                    </div>
                `;
            } else {
                document.getElementById('detail-records').innerHTML = records.map(rec => `
                    <div class="list-item">
                        <div class="list-item-icon">
                            ${rec.type === '图书' ? '📚' : rec.type === '视频' ? '🎬' : '🎧'}
                        </div>
                        <div class="list-item-content">
                            <div class="list-item-title">${rec.content_name}</div>
                            <div class="list-item-desc">${rec.content_desc} · ${rec.duration}分钟</div>
                        </div>
                    </div>
                `).join('');
            }
        }
    },
    
    // ============ 录入相关 ============
    
    /**
     * HTML转义函数，防止XSS攻击
     */
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
    
    /**
     * 提交学习记录（显示预览）
     */
    async submitRecord() {
        const type = document.getElementById('record-type').value;
        const name = document.getElementById('content-name').value.trim();
        const desc = document.getElementById('content-desc').value.trim();
        const duration = parseInt(document.getElementById('duration').value) || 0;
        
        if (!name) {
            Utils.showToast('请输入内容名称', 'error');
            return;
        }
        if (!duration || duration <= 0) {
            Utils.showToast('请输入有效的学习时长', 'error');
            return;
        }
        
        // 保存到待确认记录（对特殊字符进行HTML转义）
        this.pendingRecord = {
            type,
            content_name: this.escapeHtml(name),
            content_desc: this.escapeHtml(desc) || '',
            duration
        };
        
        // 显示预览确认弹窗
        this.showRecordPreview(this.pendingRecord);
    },
    
    // 待确认的记录
    pendingRecord: null,
    
    /**
     * 显示记录预览弹窗
     */
    showRecordPreview(record) {
        // 移除已存在的弹窗
        const existingOverlay = document.querySelector('.confirm-modal-overlay');
        if (existingOverlay) existingOverlay.remove();
        
        const overlay = document.createElement('div');
        overlay.className = 'confirm-modal-overlay';
        
        const icon = record.type === '图书' ? '📚' : record.type === '视频' ? '🎬' : '🎧';
        
        overlay.innerHTML = `
            <div class="confirm-modal" style="max-width: 400px;">
                <div class="confirm-title">📝 录入预览</div>
                <div class="confirm-message" style="text-align: left; padding: 16px; background: var(--bg-secondary); border-radius: 8px; margin: 16px 0;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                        <div style="font-size: 32px;">${icon}</div>
                        <div style="font-weight: 600; font-size: 16px;">${this.escapeHtml(record.content_name)}</div>
                    </div>
                    <div style="margin-bottom: 8px; font-size: 14px; color: #64748B;">
                        <strong>类型：</strong>${record.type}
                    </div>
                    <div style="margin-bottom: 8px; font-size: 14px; color: #64748B;">
                        <strong>时长：</strong>${record.duration} 分钟
                    </div>
                    ${record.content_desc ? `
                    <div style="font-size: 13px; color: #94A3B8; padding: 8px; background: white; border-radius: 6px; margin-top: 8px;">
                        ${this.escapeHtml(record.content_desc)}
                    </div>
                    ` : ''}
                </div>
                <div class="confirm-buttons">
                    <button class="btn confirm-btn-cancel" onclick="App.cancelRecordPreview()">返回修改</button>
                    <button class="btn confirm-btn-confirm" onclick="App.confirmRecord()">确认保存</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        setTimeout(() => overlay.classList.add('show'), 10);
        
        // 点击遮罩关闭
        overlay.onclick = (e) => { if (e.target === overlay) App.cancelRecordPreview(); };
    },
    
    /**
     * 取消预览，返回修改
     */
    cancelRecordPreview() {
        const overlay = document.querySelector('.confirm-modal-overlay');
        if (overlay) overlay.remove();
        this.pendingRecord = null;
        Utils.showToast('请修改后重新提交', 'info');
    },
    
    /**
     * 确认保存记录
     */
    async confirmRecord() {
        if (!this.pendingRecord) return;
        
        const today = Utils.getToday();
        await Storage.saveRecord(today, this.pendingRecord);
        
        // 移除预览弹窗
        const overlay = document.querySelector('.confirm-modal-overlay');
        if (overlay) overlay.remove();
        
        const record = this.pendingRecord;
        this.pendingRecord = null;
        
        // 清除表单
        document.getElementById('content-name').value = '';
        document.getElementById('content-desc').value = '';
        document.getElementById('duration').value = '';
        
        // 加入待生成题目队列（第二天上午生成）
        Storage.addToPendingQueue(record);
        
        Utils.showToast('✅ 记录已保存，题目将在次日上午生成', 'success');
        
        // 刷新日历
        this.renderCalendar();
    },
    
    /**
     * 切换录音状态
     */
    async toggleRecording() {
        const btn = document.getElementById('record-btn');
        const status = document.getElementById('record-status');
        
        if (!this.isRecording) {
            // 开始录音
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this.mediaRecorder = new MediaRecorder(stream);
                this.audioChunks = [];
                
                this.mediaRecorder.ondataavailable = (e) => {
                    this.audioChunks.push(e.data);
                };
                
                this.mediaRecorder.onstop = async () => {
                    stream.getTracks().forEach(track => track.stop());
                    await this.processRecording();
                };
                
                this.mediaRecorder.start();
                this.isRecording = true;
                btn.classList.add('recording');
                status.textContent = '正在录音...';
            } catch (err) {
                console.error('录音失败:', err);
                Utils.showToast('无法访问麦克风，请检查权限设置', 'error');
            }
        } else {
            // 停止录音
            this.mediaRecorder.stop();
            this.isRecording = false;
            btn.classList.remove('recording');
            status.textContent = '处理中...';
        }
    },
    
    /**
     * 处理录音（模拟）
     */
    async processRecording() {
        const status = document.getElementById('record-status');
        const result = document.getElementById('transcript-result');
        const text = document.getElementById('transcript-text');
        
        // 模拟AI转写和解析
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // 模拟转写结果
        const mockTranscript = `今天学习了《认知觉醒》第三章元认知部分。主要内容包括：1. 元认知是对自己思考过程的认知和理解；2. 通过元认知可以及时修正错误思维；3. 每天冥想练习可以提升元认知能力。学习时长约45分钟。`;
        
        status.textContent = '转写完成';
        text.textContent = mockTranscript;
        result.style.display = 'block';
        
        // 模拟解析拆分
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 自动填充表单
        document.getElementById('record-type').value = '图书';
        document.getElementById('content-name').value = '认知觉醒';
        document.getElementById('content-desc').value = '第三章：元认知';
        document.getElementById('duration').value = '45';
        
        Utils.showToast('已解析并填充表单，请确认提交', 'success');
        
        // 切换到手动录入tab
        document.querySelector('.tab[data-tab="manual"]').click();
    },
    
    // ============ 语音录入（新） ============
    
    /**
     * 切换语音录入状态（表单内按钮）
     */
    async toggleVoiceInput() {
        if (this.voiceRecognition) {
            // 停止录音
            this.stopVoiceInput();
        } else {
            // 开始录音
            await this.startVoiceInput();
        }
    },
    
    /**
     * 开始语音录入
     */
    async startVoiceInput() {
        // 检查浏览器支持
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            Utils.showToast('您的浏览器不支持语音识别，请使用Chrome浏览器', 'error');
            return;
        }
        
        try {
            // 请求麦克风权限
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            
            // 创建语音识别对象
            this.voiceRecognition = new SpeechRecognition();
            this.voiceRecognition.lang = 'zh-CN';
            this.voiceRecognition.continuous = true;
            this.voiceRecognition.interimResults = true;
            
            this.voiceTranscript = '';
            
            // 更新UI状态
            const status = document.getElementById('voice-status');
            const tip = document.getElementById('voice-tip');
            if (status) {
                status.style.display = 'inline';
                status.textContent = '🎤 正在录音...';
            }
            if (tip) {
                tip.textContent = '请说出学习内容，如"我今天读了《原则》第三章，学了30分钟"';
            }
            
            // 更新按钮状态
            const btn = document.querySelector('.voice-input-section .btn');
            if (btn) {
                btn.classList.add('recording');
                btn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="6" y="6" width="12" height="12" rx="2"></rect>
                    </svg>
                    停止录音
                `;
            }
            
            // 识别结果
            this.voiceRecognition.onresult = (event) => {
                let interimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        this.voiceTranscript += transcript;
                    } else {
                        interimTranscript = transcript;
                    }
                }
                
                // 实时显示识别内容
                if (status) {
                    status.textContent = '🎤 ' + (this.voiceTranscript || interimTranscript || '正在聆听...');
                }
            };
            
            this.voiceRecognition.onerror = (event) => {
                console.error('语音识别错误:', event.error);
                Utils.showToast('语音识别出错：' + event.error, 'error');
                this.stopVoiceInput();
            };
            
            this.voiceRecognition.onend = () => {
                // 语音识别自动停止后，处理结果
                if (this.voiceTranscript) {
                    this.processVoiceTranscript(this.voiceTranscript);
                } else {
                    Utils.showToast('未识别到语音内容，请重试', 'default');
                    this.stopVoiceInput();
                }
            };
            
            // 开始识别
            this.voiceRecognition.start();
            
            Utils.showToast('🎤 开始录音，请说话...', 'default');
            
        } catch (err) {
            console.error('语音录入失败:', err);
            Utils.showToast('无法访问麦克风，请检查权限设置', 'error');
            this.voiceRecognition = null;
        }
    },
    
    /**
     * 停止语音录入
     */
    stopVoiceInput() {
        if (this.voiceRecognition) {
            this.voiceRecognition.stop();
            this.voiceRecognition = null;
        }
        
        // 恢复UI状态
        const status = document.getElementById('voice-status');
        const tip = document.getElementById('voice-tip');
        if (status) {
            status.style.display = 'none';
        }
        if (tip) {
            tip.textContent = '点击麦克风开始说话，自动识别学习内容';
        }
        
        // 恢复按钮状态
        const btn = document.querySelector('.voice-input-section .btn');
        if (btn) {
            btn.classList.remove('recording');
            btn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="23"></line>
                    <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
                语音录入
            `;
        }
    },
    
    /**
     * 处理语音转写结果
     */
    async processVoiceTranscript(transcript) {
        Utils.showToast('正在AI解析...', 'default');
        
        // 调用AI提取结构化信息
        try {
            const info = await this.extractLearningInfo(transcript);
            
            // 自动填充表单
            this.fillRecordForm(info);
            
            Utils.showToast('✅ 已自动填入信息，请确认后保存', 'success');
            
        } catch (error) {
            console.error('AI解析失败:', error);
            Utils.showToast('语音解析失败，请手动填写', 'error');
        }
        
        // 重置状态
        this.voiceTranscript = '';
    },
    
    /**
     * AI提取学习信息
     */
    async extractLearningInfo(voiceText) {
        const DEEPSEEK_API_KEY = localStorage.getItem('deepseek_api_key') || 'sk-dda01297df2c4048b80578fe86e7946b';
        
        const prompt = `请从以下语音文本中提取学习信息，返回JSON格式：

语音文本："${voiceText}"

请提取以下字段：
- type: 学习类型（book=图书, video=视频, audio=音频文稿），如果用户说"书/读了书/看书"则为book，"视频/看了视频"则为video，"音频/听了音频/播客"则为audio
- title: 学习内容名称（书名/课程名/章节名等）
- duration: 学习时长（分钟数，只返回数字）
- summary: 内容简介（30字以内）

返回格式示例：
{
  "type": "book",
  "title": "《原则》第三章",
  "duration": 30,
  "summary": "系统化思维在管理中的应用"
}

注意：只返回JSON，不要其他任何文字。`;

        try {
            const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.3,
                    max_tokens: 200
                })
            });
            
            if (!response.ok) {
                throw new Error(`API调用失败: ${response.status}`);
            }
            
            const data = await response.json();
            const content = data.choices[0].message.content;
            
            // 解析JSON
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            throw new Error('无法解析AI返回结果');
            
        } catch (error) {
            console.error('AI提取失败:', error);
            
            // 降级处理：使用简单规则提取
            return this.fallbackExtract(voiceText);
        }
    },
    
    /**
     * 降级提取（简单规则）
     */
    fallbackExtract(text) {
        const typeMap = {
            '书': '图书',
            '图书': '图书',
            '视频': '视频',
            '看了视频': '视频',
            '课程': '视频',
            '音频': '音频文稿',
            '播客': '音频文稿',
            '听了': '音频文稿'
        };
        
        let type = '图书'; // 默认
        for (const [key, value] of Object.entries(typeMap)) {
            if (text.includes(key)) {
                type = value;
                break;
            }
        }
        
        // 提取书名（简单匹配）
        const titleMatch = text.match(/[《"]([^》"]+)[》"]/);
        const title = titleMatch ? titleMatch[1] : '';
        
        // 提取时长
        const durationMatch = text.match(/(\d+)\s*分钟/);
        const duration = durationMatch ? parseInt(durationMatch[1]) : 30;
        
        return {
            type: type,
            title: title,
            duration: duration,
            summary: text.substring(0, 30)
        };
    },
    
    /**
     * 填充录入表单
     */
    fillRecordForm(info) {
        // 类型映射
        const typeMap = {
            'book': '图书',
            'video': '视频',
            'audio': '音频文稿'
        };
        
        const type = typeMap[info.type] || info.type || '图书';
        
        // 填充表单
        const typeSelect = document.getElementById('record-type');
        if (typeSelect) {
            // 找到匹配的选项
            for (let i = 0; i < typeSelect.options.length; i++) {
                if (typeSelect.options[i].text.includes(type) || typeSelect.options[i].value === type) {
                    typeSelect.selectedIndex = i;
                    break;
                }
            }
        }
        
        const nameInput = document.getElementById('content-name');
        if (nameInput && info.title) {
            nameInput.value = info.title;
        }
        
        const descInput = document.getElementById('content-desc');
        if (descInput && info.summary) {
            descInput.value = info.summary;
        }
        
        const durationInput = document.getElementById('duration');
        if (durationInput && info.duration) {
            durationInput.value = info.duration;
        }
    },
    
    // ============ 任务相关 ============
    
    // 任务列表数据
    taskData: [],
    
    // 待筛选的任务数据
    _taskData: [],
    
    /**
     * 加载任务列表
     */
    async loadTasks() {
        const container = document.getElementById('task-list');
        if (!container) return;
        
        // 从存储获取真实任务数据，如果没有则使用示例数据
        const storedTasks = Storage.getTasks();
        const mockTasks = storedTasks && storedTasks.length > 0 ? storedTasks : [
            { id: 'task_1', title: '复习《认知觉醒》第一章', source: '图书', dueDate: Utils.getToday(), status: 'pending' },
            { id: 'task_2', title: '复习《Python编程》基础语法', source: '视频', dueDate: Utils.getRelativeDate(-1), status: 'pending' },
            { id: 'task_3', title: '完成本周学习总结', source: '综合', dueDate: Utils.getRelativeDate(-3), status: 'completed' }
        ];
        
        // 保存到实例数据
        this._taskData = mockTasks;
        this.taskData = mockTasks;
        
        // 只有当真正没有数据时才显示空状态
        if (!mockTasks || mockTasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                    </div>
                    <div class="empty-title">暂无任务</div>
                    <div class="empty-desc">完成学习录入后会自动生成复习任务</div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = mockTasks.map(task => `
            <div class="task-item">
                <div class="task-checkbox ${task.status === 'completed' ? 'checked' : ''}" 
                     onclick="App.toggleTask('${task.id}')"></div>
                <div class="task-content">
                    <div class="task-title ${task.status === 'completed' ? 'text-muted' : ''}" 
                         style="${task.status === 'completed' ? 'text-decoration: line-through;' : ''}">
                        ${task.title}
                    </div>
                    <div class="task-meta">
                        ${task.source} · ${task.status === 'completed' ? '已完成' : '待完成'}
                    </div>
                </div>
                ${task.status !== 'completed' ? `
                    <div class="task-actions">
                        <button class="btn btn-sm btn-outline" onclick="App.postponeTask('${task.id}')">延期</button>
                    </div>
                ` : ''}
            </div>
        `).join('');
    },
    
    /**
     * 切换任务状态
     */
    async toggleTask(taskId) {
        const confirmed = await Utils.showConfirm('完成任务', '确认完成此任务？');
        if (confirmed) {
            Utils.showToast('任务已完成', 'success');
            this.loadTasks();
        }
    },
    
    /**
     * 延期任务
     */
    async postponeTask(taskId) {
        const confirmed = await Utils.showConfirm('延期任务', '确认将此任务延期？');
        if (confirmed) {
            Utils.showToast('任务已延期', 'success');
            this.loadTasks();
        }
    },
    
    // ============ 答题相关 ============
    
    // 答题状态
    examAnswers: {},
    
    /**
     * 加载答题内容
     */
    async loadExam() {
        const container = document.getElementById('exam-content');
        if (!container) return;
        
        // 模拟考核数据
        const exam = Storage.generateMockExam();
        
        container.innerHTML = `
            <div class="card mb-4">
                <div class="card-header">
                    <div class="card-title">今日考核 · ${exam.book_name}</div>
                    <span class="card-badge">${exam.questions.length}题</span>
                </div>
                <div class="text-muted" style="font-size: 13px;">
                    请认真作答，完成后系统将进行评分
                </div>
            </div>
            
            ${exam.questions.map((q, index) => `
                <div class="question-card" id="question-${q.id}">
                    <div class="question-header">
                        <span class="question-type ${q.type === '记忆' ? 'memory' : 'understanding'}">
                            ${q.type === '记忆' ? '💭 记忆题' : '💡 理解题'}
                        </span>
                        <span class="question-source">来源：${q.source}</span>
                    </div>
                    <div class="question-text">${index + 1}. ${q.question}</div>
                    
                    <div class="question-answer">
                        <label>你的回答：</label>
                        <div class="mt-2 flex items-center gap-3">
                            <button class="record-btn ${this.examAnswers[q.id] ? 'recording' : ''}" 
                                    style="width: 48px; height: 48px;" 
                                    id="record-btn-${q.id}"
                                    onclick="App.toggleRecordAnswer('${q.id}')">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"></path>
                                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                                </svg>
                            </button>
                            <div class="text-muted" style="font-size: 12px;">
                                点击麦克风录音作答
                            </div>
                        </div>
                        <div class="answer-text mt-3" id="answer-text-${q.id}" style="display: none;">
                            <div class="card" style="background: var(--bg-secondary); padding: 12px; border-radius: 8px;">
                                <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">作答内容：</div>
                                <div id="answer-content-${q.id}" style="font-size: 14px;"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}
            
            <button class="btn btn-primary btn-lg" style="width: 100%;" onclick="App.submitExam()">
                提交考核
            </button>
        `;
    },
    
    // 当前录音状态
    currentRecording: null,
    recognition: null,
    
    /**
     * 切换录音状态
     */
    toggleRecordAnswer(questionId) {
        if (this.currentRecording === questionId) {
            // 停止录音
            this.stopRecording();
        } else {
            // 开始录音
            this.startRecording(questionId);
        }
    },
    
    /**
     * 开始录音
     */
    startRecording(questionId) {
        // 检查浏览器支持
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            Utils.showToast('您的浏览器不支持语音识别，请使用Chrome浏览器', 'error');
            return;
        }
        
        // 停止之前的录音
        if (this.currentRecording) {
            this.stopRecording();
        }
        
        // 创建语音识别对象
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'zh-CN';
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        
        this.currentRecording = questionId;
        
        // 更新按钮状态
        const btn = document.getElementById(`record-btn-${questionId}`);
        if (btn) {
            btn.classList.add('recording');
            btn.style.background = '#EF4444';
        }
        
        Utils.showToast('🎤 开始录音，请说话...', 'default');
        
        // 识别结果
        let finalTranscript = '';
        let interimTranscript = '';
        
        this.recognition.onresult = (event) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript = transcript;
                }
            }
            
            // 显示识别结果
            const answerText = document.getElementById(`answer-text-${questionId}`);
            const answerContent = document.getElementById(`answer-content-${questionId}`);
            if (answerText && answerContent) {
                answerText.style.display = 'block';
                answerContent.textContent = finalTranscript || interimTranscript || '正在识别...';
            }
            
            // 保存答案
            if (finalTranscript) {
                this.examAnswers[questionId] = {
                    text: finalTranscript,
                    timestamp: Date.now()
                };
            }
        };
        
        this.recognition.onerror = (event) => {
            console.error('语音识别错误:', event.error);
            Utils.showToast('语音识别出错：' + event.error, 'error');
            this.stopRecording();
        };
        
        this.recognition.onend = () => {
            // 自动停止录音后更新状态
            if (this.currentRecording === questionId) {
                this.stopRecording();
            }
        };
        
        // 开始识别
        this.recognition.start();
    },
    
    /**
     * 停止录音
     */
    stopRecording() {
        if (this.recognition) {
            this.recognition.stop();
            this.recognition = null;
        }
        
        const questionId = this.currentRecording;
        this.currentRecording = null;
        
        // 更新按钮状态
        if (questionId) {
            const btn = document.getElementById(`record-btn-${questionId}`);
            if (btn) {
                btn.classList.remove('recording');
                btn.style.background = '';
            }
            
            if (this.examAnswers[questionId]) {
                Utils.showToast('✅ 录音完成，已保存答案', 'success');
            }
        }
    },
    
    /**
     * 设置评分
     */
    setScore(questionId, score) {
        const container = document.getElementById(`star-rating-${questionId}`);
        if (!container) return;
        
        container.querySelectorAll('.star').forEach((s, i) => {
            s.classList.toggle('active', i < score);
        });
        
        // 保存评分
        if (!this.examAnswers[questionId]) {
            this.examAnswers[questionId] = {};
        }
        this.examAnswers[questionId].score = score;
    },
    
    /**
     * 提交考核
     */
    async submitExam() {
        // 检查是否有答案
        const answers = this.examAnswers;
        const answerCount = Object.keys(answers).length;
        
        if (answerCount === 0) {
            Utils.showToast('请至少回答一道题', 'error');
            return;
        }
        
        const confirmed = await Utils.showConfirm('提交考核', `已回答${answerCount}道题，确认提交？`);
        if (!confirmed) return;
        
        Utils.showToast('正在AI评分中，请稍候...', 'default');
        
        try {
            // 调用AI评分
            const results = await this.aiGradeAnswers(answers);
            
            // 显示评分结果页
            this.showExamResults(results);
            
        } catch (error) {
            console.error('AI评分失败:', error);
            Utils.showToast('评分失败：' + error.message, 'error');
        }
    },
    
    /**
     * AI评分 - 调用DeepSeek
     */
    async aiGradeAnswers(answers) {
        const DEEPSEEK_API_KEY = localStorage.getItem('deepseek_api_key') || 'sk-dda01297df2c4048b80578fe86e7946b';
        const results = [];
        
        // 获取题目信息
        const exam = Storage.generateMockExam();
        const questions = exam.questions;
        
        for (const q of questions) {
            const answer = answers[q.id];
            if (!answer || !answer.text) {
                results.push({
                    questionId: q.id,
                    question: q.question,
                    type: q.type,
                    answer: '未作答',
                    scores: { accuracy: 0, clarity: 0, mastery: 0, total: 0 },
                    comment: '未作答'
                });
                continue;
            }
            
            // 调用DeepSeek API评分
            try {
                const prompt = `你是一位专业的学习评测老师。请对学生的回答进行评分。

题目：${q.question}
题目类型：${q.type === '记忆' ? '记忆题（考察对知识点的记忆）' : '理解题（考察对知识的理解和应用）'}

学生回答：${answer.text}

请从以下三个维度评分（每项1-10分）：
1. 内容准确性：答案是否准确、完整
2. 表达清晰度：表达是否清晰、有条理
3. 知识掌握度：对相关知识的理解程度

请用JSON格式返回评分结果，格式如下：
{
  "accuracy": 数字,
  "clarity": 数字,
  "mastery": 数字,
  "comment": "详细评价（至少50字，指出优点和改进建议）"
}

只返回JSON，不要其他内容。`;

                const response = await fetch('https://api.deepseek.com/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: 'deepseek-chat',
                        messages: [
                            { role: 'system', content: '你是一位专业的学习评测老师，擅长对学生的回答进行客观、详细的评分和点评。' },
                            { role: 'user', content: prompt }
                        ],
                        temperature: 0.7,
                        max_tokens: 500
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`API调用失败: ${response.status}`);
                }
                
                const data = await response.json();
                const content = data.choices[0].message.content;
                
                // 解析JSON
                let gradeResult;
                try {
                    // 尝试提取JSON
                    const jsonMatch = content.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        gradeResult = JSON.parse(jsonMatch[0]);
                    } else {
                        throw new Error('无法解析评分结果');
                    }
                } catch (e) {
                    // 解析失败，使用默认值
                    gradeResult = {
                        accuracy: 5,
                        clarity: 5,
                        mastery: 5,
                        comment: content
                    };
                }
                
                results.push({
                    questionId: q.id,
                    question: q.question,
                    type: q.type,
                    answer: answer.text,
                    scores: {
                        accuracy: gradeResult.accuracy || 5,
                        clarity: gradeResult.clarity || 5,
                        mastery: gradeResult.mastery || 5,
                        total: Math.round(((gradeResult.accuracy || 5) + (gradeResult.clarity || 5) + (gradeResult.mastery || 5)) / 3 * 10) / 10
                    },
                    comment: gradeResult.comment || '暂无评价'
                });
                
            } catch (error) {
                console.error('评分出错:', error);
                results.push({
                    questionId: q.id,
                    question: q.question,
                    type: q.type,
                    answer: answer.text,
                    scores: { accuracy: 5, clarity: 5, mastery: 5, total: 5 },
                    comment: '评分服务暂时不可用'
                });
            }
        }
        
        return results;
    },
    
    /**
     * 显示评分结果页
     */
    showExamResults(results) {
        // 计算总分
        const totalScore = results.reduce((sum, r) => sum + r.scores.total, 0);
        const avgScore = (totalScore / results.length).toFixed(1);
        
        // 计算各维度平均分
        const avgAccuracy = (results.reduce((sum, r) => sum + r.scores.accuracy, 0) / results.length).toFixed(1);
        const avgClarity = (results.reduce((sum, r) => sum + r.scores.clarity, 0) / results.length).toFixed(1);
        const avgMastery = (results.reduce((sum, r) => sum + r.scores.mastery, 0) / results.length).toFixed(1);
        
        const container = document.getElementById('exam-content');
        if (!container) return;
        
        container.innerHTML = `
            <div class="card mb-4" style="background: linear-gradient(135deg, #7C3AED, #A78BFA); color: white;">
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 48px; font-weight: bold;">${avgScore}</div>
                    <div style="font-size: 14px; opacity: 0.9;">综合评分（满分10分）</div>
                </div>
                <div style="display: flex; justify-content: space-around; padding: 16px 0; border-top: 1px solid rgba(255,255,255,0.2);">
                    <div style="text-align: center;">
                        <div style="font-size: 20px; font-weight: bold;">${avgAccuracy}</div>
                        <div style="font-size: 12px; opacity: 0.8;">准确性</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 20px; font-weight: bold;">${avgClarity}</div>
                        <div style="font-size: 12px; opacity: 0.8;">清晰度</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 20px; font-weight: bold;">${avgMastery}</div>
                        <div style="font-size: 12px; opacity: 0.8;">掌握度</div>
                    </div>
                </div>
            </div>
            
            <div class="page-header" style="margin-bottom: 16px;">
                <div class="page-title">AI评价详情</div>
            </div>
            
            ${results.map((r, index) => `
                <div class="card mb-4">
                    <div class="card-header">
                        <span class="question-type ${r.type === '记忆' ? 'memory' : 'understanding'}">
                            ${r.type === '记忆' ? '💭 记忆题' : '💡 理解题'}
                        </span>
                        <span style="font-weight: bold; color: #7C3AED;">${r.scores.total}分</span>
                    </div>
                    <div style="padding: 16px;">
                        <div style="font-weight: 500; margin-bottom: 12px;">${index + 1}. ${r.question}</div>
                        
                        <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; margin-bottom: 12px;">
                            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">你的回答：</div>
                            <div style="font-size: 14px;">${r.answer}</div>
                        </div>
                        
                        <div style="display: flex; gap: 16px; margin-bottom: 12px; font-size: 13px;">
                            <span>准确性: ${r.scores.accuracy}/10</span>
                            <span>清晰度: ${r.scores.clarity}/10</span>
                            <span>掌握度: ${r.scores.mastery}/10</span>
                        </div>
                        
                        <div style="background: linear-gradient(135deg, #F3E8FF, #E9D5FF); padding: 12px; border-radius: 8px;">
                            <div style="font-size: 12px; color: #7C3AED; margin-bottom: 4px;">💡 AI点评：</div>
                            <div style="font-size: 14px; color: #1E293B; line-height: 1.6;">${r.comment}</div>
                        </div>
                    </div>
                </div>
            `).join('')}
            
            <button class="btn btn-primary btn-lg" style="width: 100%;" onclick="Router.go('home')">
                返回首页
            </button>
        `;
        
        // 保存评分结果
        Storage.saveExamResult({
            date: new Date().toISOString().split('T')[0],
            results: results,
            avgScore: parseFloat(avgScore),
            timestamp: Date.now()
        });
        
        Utils.showToast('✅ AI评分完成！', 'success');
    },
    
    // ============ 学习档案相关 ============
    
    // 当前档案Tab
    currentArchiveTab: 'by-content',
    
    // 档案日历状态
    archiveCalendarYear: new Date().getFullYear(),
    archiveCalendarMonth: new Date().getMonth() + 1,
    
    /**
     * 切换档案Tab
     */
    async switchArchiveTab(tab) {
        this.currentArchiveTab = tab;
        
        // 更新Tab状态
        document.querySelectorAll('.archive-tabs .tab, .tabs .tab').forEach(t => {
            if (t.dataset.tab === tab) {
                t.classList.add('active');
            } else {
                t.classList.remove('active');
            }
        });
        
        // 渲染内容
        if (tab === 'by-content') {
            await this.loadArchiveByContent();
        } else {
            await this.loadArchiveByDate();
        }
    },
    
    /**
     * 加载学习档案
     */
    async loadArchive() {
        // 默认加载按内容查看
        await this.loadArchiveByContent();
    },
    
    /**
     * 按内容查看
     */
    async loadArchiveByContent() {
        const container = document.getElementById('archive-content');
        if (!container) return;
        
        // 添加二级Tab
        container.innerHTML = `
            <div class="tabs mb-4" style="background: transparent; padding: 0;">
                <button class="tab active" data-type="all" onclick="App.loadArchiveList('all')">全部</button>
                <button class="tab" data-type="book" onclick="App.loadArchiveList('book')">📚 图书</button>
                <button class="tab" data-type="video" onclick="App.loadArchiveList('video')">🎬 视频</button>
                <button class="tab" data-type="audio" onclick="App.loadArchiveList('audio')">🎧 音频</button>
            </div>
            <div id="archive-list">
                <div class="loading"><div class="spinner"></div></div>
            </div>
        `;
        
        // 加载全部内容
        await this.loadArchiveList('all');
    },
    
    /**
     * 加载档案列表
     */
    async loadArchiveList(type = 'all') {
        const container = document.getElementById('archive-list');
        if (!container) return;
        
        // 更新Tab状态
        container.parentElement.querySelectorAll('.tab').forEach(t => {
            t.classList.toggle('active', t.dataset.type === type);
        });
        
        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
        
        try {
            let learnings;
            if (type === 'all') {
                const index = await Storage.getBookIndex();
                learnings = index.items || [];
            } else {
                learnings = await Storage.getLearningsByType(type);
            }
            
            if (learnings.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                            </svg>
                        </div>
                        <div class="empty-title">暂无学习档案</div>
                        <div class="empty-desc">开始学习后将自动生成学习档案</div>
                    </div>
                `;
                return;
            }
            
            // 获取每个学习内容的统计数据
            const learningsWithStats = await Promise.all(learnings.map(async (learning) => {
                const records = await Storage.getRecordsByLearningName(learning.name);
                const answers = await Storage.getAnswersByLearningName(learning.name);
                
                // 计算统计数据
                const uniqueDays = [...new Set(records.map(r => r.date))];
                const totalDuration = records.reduce((sum, r) => sum + (r.duration || 0), 0);
                const avgScore = answers.length > 0 
                    ? (answers.reduce((sum, a) => sum + (a.avgScore || 0), 0) / answers.length).toFixed(1)
                    : 0;
                
                return {
                    ...learning,
                    days: uniqueDays.length,
                    times: records.length,
                    duration: totalDuration,
                    avgScore: avgScore
                };
            }));
            
            // 按学习次数排序
            learningsWithStats.sort((a, b) => b.times - a.times);
            
            const typeIcon = {
                '图书': '📚',
                '视频': '🎬',
                '音频文稿': '🎧'
            };
            
            container.innerHTML = learningsWithStats.map(learning => `
                <div class="learning-item card" onclick="App.showArchiveDetail('${encodeURIComponent(learning.name)}')">
                    <div class="learning-icon">${typeIcon[learning.type] || '📖'}</div>
                    <div class="learning-info">
                        <div class="learning-title">${this.escapeHtml(learning.name)}</div>
                        <div class="learning-stats">
                            <span class="stat-item">📅 打卡${learning.days}天</span>
                            <span class="stat-item">📊 共${learning.times}次</span>
                            <span class="stat-item">⏱ ${learning.duration}分钟</span>
                            ${learning.avgScore > 0 ? `<span class="stat-item">⭐ 均分${learning.avgScore}</span>` : ''}
                            <span class="badge ${learning.status === 'completed' ? 'badge-success' : 'badge-warning'}">
                                ${learning.status === 'completed' ? '✅ 已完成' : '📖 学习中'}
                            </span>
                        </div>
                    </div>
                    <div class="learning-arrow">›</div>
                </div>
            `).join('');
            
        } catch (error) {
            console.error('加载档案列表失败:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-title">加载失败</div>
                    <div class="empty-desc">请稍后重试</div>
                </div>
            `;
        }
    },
    
    /**
     * 显示档案详情
     */
    async showArchiveDetail(contentName) {
        const name = decodeURIComponent(contentName);
        
        try {
            const learning = await Storage.getLearningByName(name);
            const records = await Storage.getRecordsByLearningName(name);
            const answers = await Storage.getAnswersByLearningName(name);
            
            // 计算统计
            const uniqueDays = [...new Set(records.map(r => r.date))];
            const totalDuration = records.reduce((sum, r) => sum + (r.duration || 0), 0);
            const avgScore = answers.length > 0 
                ? (answers.reduce((sum, a) => sum + (a.avgScore || 0), 0) / answers.length).toFixed(1)
                : '-';
            
            const typeIcon = {
                '图书': '📚',
                '视频': '🎬',
                '音频文稿': '🎧'
            };
            
            // 构建详情页HTML
            const container = document.getElementById('archive-list');
            container.innerHTML = `
                <button class="back-btn mb-4" onclick="App.loadArchiveByContent()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                    返回列表
                </button>
                
                <div class="card mb-4">
                    <div class="flex items-center gap-4">
                        <div class="learning-icon" style="font-size: 48px;">
                            ${typeIcon[learning?.type] || '📖'}
                        </div>
                        <div>
                            <div class="font-semibold" style="font-size: 18px;">${this.escapeHtml(name)}</div>
                            <div class="text-muted mt-2">
                                <span class="tag tag-primary">${learning?.type || '未知'}</span>
                                <span class="badge ${learning?.status === 'completed' ? 'badge-success' : 'badge-warning'}">
                                    ${learning?.status === 'completed' ? '已完成' : '学习中'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="stats-cards">
                    <div class="stat-card">
                        <div class="stat-number">${uniqueDays.length}</div>
                        <div class="stat-label">打卡天数</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${records.length}</div>
                        <div class="stat-label">打卡次数</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${totalDuration}</div>
                        <div class="stat-label">总时长(分钟)</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${avgScore}</div>
                        <div class="stat-label">平均分</div>
                    </div>
                </div>
                
                <h3 class="mb-4">打卡记录</h3>
                ${records.length === 0 ? `
                    <div class="empty-state">
                        <div class="empty-desc">暂无打卡记录</div>
                    </div>
                ` : records.sort((a, b) => b.date.localeCompare(a.date)).map(record => {
                    const answer = answers.find(a => a.date === record.date);
                    return `
                        <div class="card mb-3">
                            <div class="flex justify-between items-center mb-2">
                                <span class="font-medium">${record.date}</span>
                                <span class="text-muted">${record.duration || 0}分钟</span>
                            </div>
                            <div class="text-muted mb-2" style="font-size: 13px;">
                                ${this.escapeHtml(record.content_desc || record.content_name)}
                            </div>
                            ${answer ? `
                                <div class="flex items-center gap-2">
                                    <span class="badge badge-success">已答题</span>
                                    <span class="text-muted" style="font-size: 13px;">评分: ${answer.avgScore || '-'}</span>
                                </div>
                            ` : `
                                <span class="badge badge-muted">未答题</span>
                            `}
                        </div>
                    `;
                }).join('')}
            `;
            
        } catch (error) {
            console.error('加载详情失败:', error);
            Utils.showToast('加载详情失败', 'error');
        }
    },
    
    /**
     * 按日期查看
     */
    async loadArchiveByDate() {
        const container = document.getElementById('archive-content');
        if (!container) return;
        
        container.innerHTML = `
            <div class="calendar mb-4" id="archive-calendar">
                <div class="calendar-header">
                    <div class="calendar-title" id="archive-calendar-title">
                        ${this.archiveCalendarYear}年${this.archiveCalendarMonth}月
                    </div>
                    <div class="calendar-nav">
                        <button onclick="App.prevArchiveMonth()">‹</button>
                        <button onclick="App.nextArchiveMonth()">›</button>
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
                <div class="calendar-days" id="archive-calendar-days"></div>
            </div>
            
            <div id="archive-date-records">
                <div class="empty-state">
                    <div class="empty-title">选择日期查看记录</div>
                    <div class="empty-desc">点击日历上的日期查看当天学习记录</div>
                </div>
            </div>
        `;
        
        await this.renderArchiveCalendar();
    },
    
    /**
     * 渲染档案日历
     */
    async renderArchiveCalendar() {
        const year = this.archiveCalendarYear;
        const month = this.archiveCalendarMonth;
        
        document.getElementById('archive-calendar-title').textContent = 
            `${year}年${month}月`;
        
        // 获取该月有记录的日期
        const recordDates = await this.getMonthRecordDates(year, month);
        
        // 计算日历数据
        const firstDay = new Date(year, month - 1, 1).getDay();
        const daysInMonth = new Date(year, month, 0).getDate();
        
        let html = '';
        
        // 上月空白
        const prevMonth = new Date(year, month - 2, 1);
        const prevMonthDays = new Date(year, month - 1, 0).getDate();
        for (let i = firstDay - 1; i >= 0; i--) {
            html += `<div class="calendar-day other-month">${prevMonthDays - i}</div>`;
        }
        
        // 当月日期
        const today = Utils.getToday();
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const hasRecord = recordDates.includes(dateStr);
            const isToday = dateStr === today;
            
            let classes = 'calendar-day';
            if (isToday) classes += ' today';
            if (hasRecord) classes += ' has-record';
            
            html += `
                <div class="${classes}" data-date="${dateStr}" onclick="App.selectArchiveDate('${dateStr}')">
                    ${day}
                </div>
            `;
        }
        
        // 下月空白
        const totalCells = firstDay + daysInMonth;
        const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
        for (let i = 1; i <= remaining; i++) {
            html += `<div class="calendar-day other-month">${i}</div>`;
        }
        
        document.getElementById('archive-calendar-days').innerHTML = html;
    },
    
    /**
     * 获取月份有记录的日期列表
     */
    async getMonthRecordDates(year, month) {
        const recordDates = [];
        const daysInMonth = new Date(year, month, 0).getDate();
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const records = await Storage.getRecordsByDate(dateStr);
            if (records.length > 0) {
                recordDates.push(dateStr);
            }
        }
        
        return recordDates;
    },
    
    /**
     * 上个月（档案日历）
     */
    async prevArchiveMonth() {
        this.archiveCalendarMonth--;
        if (this.archiveCalendarMonth < 1) {
            this.archiveCalendarMonth = 12;
            this.archiveCalendarYear--;
        }
        await this.renderArchiveCalendar();
    },
    
    /**
     * 下个月（档案日历）
     */
    async nextArchiveMonth() {
        this.archiveCalendarMonth++;
        if (this.archiveCalendarMonth > 12) {
            this.archiveCalendarMonth = 1;
            this.archiveCalendarYear++;
        }
        await this.renderArchiveCalendar();
    },
    
    /**
     * 选择档案日期
     */
    async selectArchiveDate(dateStr) {
        // 高亮选中日期
        document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('selected'));
        const selected = document.querySelector(`.calendar-day[data-date="${dateStr}"]`);
        if (selected) {
            selected.classList.add('selected');
        }
        
        // 显示该日期的记录
        await this.showArchiveDateRecords(dateStr);
    },
    
    /**
     * 显示选中日期的学习记录
     */
    async showArchiveDateRecords(dateStr) {
        const container = document.getElementById('archive-date-records');
        
        try {
            const records = await Storage.getRecordsByDate(dateStr);
            const answers = await Storage.getAnswersByDate(dateStr);
            
            const typeIcon = {
                '图书': '📚',
                '视频': '🎬',
                '音频文稿': '🎧'
            };
            
            if (records.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-title">${dateStr}</div>
                        <div class="empty-desc">这一天没有学习记录</div>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = `
                <h3 class="mb-4">${dateStr}的学习记录</h3>
                ${records.map(record => {
                    const answer = answers.find(a => a.learning_id === record.id || a.contentName === record.content_name);
                    return `
                        <div class="card mb-3">
                            <div class="flex items-center gap-3">
                                <div style="font-size: 28px;">${typeIcon[record.type] || '📖'}</div>
                                <div class="flex-1">
                                    <div class="font-medium">${this.escapeHtml(record.content_name)}</div>
                                    <div class="text-muted" style="font-size: 13px;">
                                        ${this.escapeHtml(record.content_desc || '')} · ${record.duration || 0}分钟
                                    </div>
                                </div>
                                <div>
                                    ${answer ? `
                                        <span class="badge badge-success">评分: ${answer.avgScore || '-'}</span>
                                    ` : `
                                        <span class="badge badge-muted">未答题</span>
                                    `}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            `;
            
        } catch (error) {
            console.error('加载日期记录失败:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-title">加载失败</div>
                    <div class="empty-desc">请稍后重试</div>
                </div>
            `;
        }
    },
    
    /**
     * 标记完成
     */
    async markComplete(bookId) {
        const confirmed = await Utils.showConfirm('标记完成', '确认将此内容标记为已完成？');
        if (confirmed) {
            Utils.showToast('已标记为完成', 'success');
            this.loadArchive();
        }
    },
    
    // ============ 知识库相关 ============
    
    // 知识库原始数据
    _knowledgeData: [],
    
    /**
     * 加载知识库
     */
    async loadKnowledge() {
        const container = document.getElementById('knowledge-list');
        if (!container) return;
        
        // 模拟知识库数据
        const mockKnowledge = [
            { name: '认知觉醒', content: '## 第一章：大脑的原理\n- 本能脑：约3.6亿年前演化\n- 情绪脑：约2亿年前演化\n- 理智脑：约250万年前演化\n\n## 第二章：潜意识\n- 模糊的类型：认知模糊、情绪模糊、行动模糊\n- 消除模糊：学习知识、保持清醒、详细审视' },
            { name: 'Python基础', content: '## 数据类型\n- 整数、浮点数、字符串\n- 列表、元组、字典\n\n## 控制流\n- if条件判断\n- for/while循环' }
        ];
        
        // 保存原始数据用于搜索
        this._knowledgeData = mockKnowledge;
        
        // 只有当真正没有数据时才显示空状态
        if (!mockKnowledge || mockKnowledge.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                        </svg>
                    </div>
                    <div class="empty-title">知识库为空</div>
                    <div class="empty-desc">点击"新建"开始构建你的知识体系</div>
                </div>
            `;
            return;
        }
        
        this.renderKnowledgeList(mockKnowledge);
    },
    
    /**
     * 渲染知识库列表
     */
    renderKnowledgeList(items) {
        const container = document.getElementById('knowledge-list');
        if (!container) return;
        
        if (!items || items.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                        </svg>
                    </div>
                    <div class="empty-title">未找到匹配结果</div>
                    <div class="empty-desc">尝试其他关键词搜索</div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = items.map(item => `
            <div class="card mb-4">
                <div class="knowledge-item-title font-semibold" onclick="App.toggleKnowledge(this)">
                    📖 ${item.name}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </div>
                <div class="knowledge-item-content" style="display: none;">
                    <pre style="white-space: pre-wrap; font-family: inherit; font-size: 13px;">${item.content}</pre>
                </div>
            </div>
        `).join('');
    },
    
    /**
     * 搜索知识库
     */
    searchKnowledge(keyword) {
        const trimmed = keyword.trim().toLowerCase();
        
        if (!trimmed) {
            // 无关键词，显示全部
            this.renderKnowledgeList(this._knowledgeData);
            return;
        }
        
        // 过滤匹配项
        const filtered = this._knowledgeData.filter(item => 
            item.name.toLowerCase().includes(trimmed) || 
            item.content.toLowerCase().includes(trimmed)
        );
        
        this.renderKnowledgeList(filtered);
    },
    
    /**
     * 切换知识库展开
     */
    toggleKnowledge(header) {
        const content = header.nextElementSibling;
        const icon = header.querySelector('svg');
        const isHidden = content.style.display === 'none';
        
        content.style.display = isHidden ? 'block' : 'none';
        icon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    },
    
    /**
     * 新建知识库
     */
    addKnowledge() {
        Utils.showToast('新建功能开发中', 'default');
    },
    
    // ============ 统计相关 ============
    
    /**
     * 加载统计数据
     */
    async loadStats() {
        // 模拟统计数据
        const stats = {
            totalHours: 128,
            totalContents: 35,
            completedRate: 78,
            avgMastery: 7.5
        };
        
        const hoursEl = document.getElementById('stat-hours');
        const contentsEl = document.getElementById('stat-contents');
        const rateEl = document.getElementById('stat-rate');
        const masteryEl = document.getElementById('stat-mastery');
        
        if (hoursEl) hoursEl.textContent = stats.totalHours;
        if (contentsEl) contentsEl.textContent = stats.totalContents;
        if (rateEl) rateEl.textContent = stats.completedRate + '%';
        if (masteryEl) masteryEl.textContent = stats.avgMastery;
    }
};

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
