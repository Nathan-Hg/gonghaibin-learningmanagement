/**
 * 工具函数模块
 */
const Utils = {
    // 生成唯一ID
    generateId: function(prefix = '') {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return prefix + timestamp + '_' + random;
    },

    // 格式化日期
    formatDate: function(date, format = 'YYYY-MM-DD') {
        const d = date instanceof Date ? date : new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        
        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hours)
            .replace('mm', minutes)
            .replace('ss', seconds);
    },

    // 获取今天日期字符串
    getToday: function() {
        return this.formatDate(new Date(), 'YYYY-MM-DD');
    },

    // 获取相对日期
    getRelativeDate: function(days) {
        const date = new Date();
        date.setDate(date.getDate() + days);
        return this.formatDate(date, 'YYYY-MM-DD');
    },

    // 获取月份第一天
    getMonthFirstDay: function(date = new Date()) {
        const d = new Date(date);
        return new Date(d.getFullYear(), d.getMonth(), 1);
    },

    // 获取月份最后一天
    getMonthLastDay: function(date = new Date()) {
        const d = new Date(date);
        return new Date(d.getFullYear(), d.getMonth() + 1, 0);
    },

    // 获取月份天数
    getMonthDays: function(date = new Date()) {
        return this.getMonthLastDay(date).getDate();
    },

    // 获取月份名称
    getMonthName: function(date = new Date()) {
        const names = ['一月', '二月', '三月', '四月', '五月', '六月', 
                       '七月', '八月', '九月', '十月', '十一月', '十二月'];
        return names[new Date(date).getMonth()];
    },

    // 计算学习强度等级
    getIntensityLevel: function(recordCount) {
        if (recordCount === 0) return 0;
        if (recordCount === 1) return 1;
        if (recordCount === 2) return 2;
        return 3;
    },

    // 计算掌握度星级
    getMasteryStars: function(score) {
        return Math.round(score / 2); // 10分制转5星制
    },

    // 防抖函数
    debounce: function(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    // 节流函数
    throttle: function(func, wait) {
        let timeout;
        return function(...args) {
            if (!timeout) {
                timeout = setTimeout(() => timeout = null, wait);
                func.apply(this, args);
            }
        };
    },

    // 本地存储封装
    storage: {
        get: function(key, defaultValue = null) {
            try {
                const value = localStorage.getItem(key);
                return value ? JSON.parse(value) : defaultValue;
            } catch (e) {
                console.error('Storage get error:', e);
                return defaultValue;
            }
        },
        set: function(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (e) {
                console.error('Storage set error:', e);
                return false;
            }
        },
        remove: function(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (e) {
                console.error('Storage remove error:', e);
                return false;
            }
        }
    },

    // 显示Toast提示
    showToast: function(message, type = 'default', duration = 2000) {
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        
        toast.textContent = message;
        toast.className = 'toast ' + type;
        
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    },

    // 显示确认弹层
    showConfirm: function(title, message) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'confirm-modal-overlay';
            overlay.innerHTML = `
                <div class="confirm-modal">
                    <div class="confirm-title">${title}</div>
                    <div class="confirm-message">${message}</div>
                    <div class="confirm-buttons">
                        <button class="btn confirm-btn-cancel" data-action="cancel">取消</button>
                        <button class="btn confirm-btn-confirm" data-action="confirm">确认</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(overlay);
            setTimeout(() => overlay.classList.add('show'), 10);
            
            const close = (result) => {
                overlay.classList.remove('show');
                setTimeout(() => overlay.remove(), 300);
                resolve(result);
            };
            
            overlay.querySelector('[data-action="cancel"]').onclick = () => close(false);
            overlay.querySelector('[data-action="confirm"]').onclick = () => close(true);
            overlay.onclick = (e) => { if (e.target === overlay) close(false); };
        });
    },

    // 获取用户头像首字母
    getUserInitial: function(name) {
        return name ? name.charAt(0).toUpperCase() : 'U';
    },

    // 截断文本
    truncate: function(text, length) {
        if (!text) return '';
        return text.length > length ? text.substring(0, length) + '...' : text;
    },

    // 复制到剪贴板
    copyToClipboard: function(text) {
        if (navigator.clipboard) {
            return navigator.clipboard.writeText(text);
        }
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        return Promise.resolve();
    },

    // 格式化学习时长
    formatDuration: function(minutes) {
        if (minutes < 60) return minutes + '分钟';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? hours + '小时' + mins + '分钟' : hours + '小时';
    },

    // 相对时间显示
    timeAgo: function(date) {
        const now = new Date();
        const past = new Date(date);
        const diff = Math.floor((now - past) / 1000);
        
        if (diff < 60) return '刚刚';
        if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
        if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
        if (diff < 604800) return Math.floor(diff / 86400) + '天前';
        return Utils.formatDate(date, 'YYYY-MM-DD');
    }
};
