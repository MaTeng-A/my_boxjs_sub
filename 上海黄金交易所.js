// 上海黄金交易所数据脚本 - 修复交易时间判断
const API_KEY = "f24e2fa4068b20c4d44fbff66b7745de";
const API_URL = "http://web.juhe.cn/finance/gold/shgold";

// 交易时间配置 - 精确到分钟
const TRADING_HOURS = {
    day: {
        start: { hour: 9, minute: 0 },   // 日盘开始 09:00
        end: { hour: 15, minute: 30 }    // 日盘结束 15:30
    },
    night: {
        start: { hour: 20, minute: 0 },  // 夜盘开始 20:00
        end: { hour: 2, minute: 30 }     // 夜盘结束 02:30（次日）
    }
};

// Loon兼容延迟函数
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
    try {
        console.log("开始获取黄金数据...");
        
        const now = new Date();
        
        // 首先检查是否在交易时间内
        const isTrading = isTradingTime(now);
        console.log(`当前时间: ${now.toLocaleString('zh-CN')}`);
        console.log(`交易状态: ${isTrading ? '交易中' : '非交易时间'}`);
        
        const goldData = await fetchGoldData();
        
        // 显示基本统计信息
        console.log(`获取到 ${goldData.resultCount || 0} 个结果元素`);
        if (goldData.allProducts) {
            console.log(`总共提取到 ${goldData.allProducts.length} 个有效黄金品种`);
            
            const validCount = goldData.allProducts.filter(item => hasValidPriceData(item)).length;
            console.log(`价格有效的品种：${validCount}/${goldData.allProducts.length}`);
        }
        
        console.log("---");
        
        // 检查数据有效性
        const hasValidData = checkDataValidity(goldData, isTrading);
        
        if (hasValidData && isTrading) {
            // 交易时间内且有有效数据
            await displayAllProductsData(goldData);
            await sendMultipleNotifications(now, goldData);
            console.log("所有通知发送完成");
        } else if (hasValidData && !isTrading) {
            // 非交易时间但有数据（可能是收盘数据）
            await displayAllProductsData(goldData, false);
            await sendMarketCloseNotification(now, goldData);
            console.log("市场收盘通知已发送（有参考数据）");
        } else if (!hasValidData && isTrading) {
            // 交易时间内但无有效数据
            await displayAllProductsNoData(goldData);
            await sendMarketDataErrorNotification(now, goldData);
            console.log("市场数据异常通知已发送");
        } else {
            // 非交易时间且无数据
            await displayAllProductsNoData(goldData);
            await sendMarketCloseNotification(now);
            console.log("市场收盘通知已发送");
        }
        
        $done();
        
    } catch (error) {
        console.log("脚本错误: " + error);
        $notification.post(
            "🛎 上海黄金交易所", 
            "系统错误", 
            `错误信息: ${error}`
        );
        $done();
    }
})();

// ⏰ 修复交易时间判断函数
function isTradingTime(now) {
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTime = hour * 100 + minute; // 转换为HHMM格式
    
    console.log(`当前时间: ${hour}:${minute.toString().padStart(2, '0')} (${currentTime})`);
    
    // 日盘时间检查 (09:00 - 15:30)
    const dayStart = 900;  // 09:00
    const dayEnd = 1530;   // 15:30
    
    // 夜盘时间检查 (20:00 - 次日02:30)
    const nightStart = 2000; // 20:00
    const nightEnd = 230;    // 02:30
    
    // 检查日盘
    if (currentTime >= dayStart && currentTime <= dayEnd) {
        console.log("✅ 在日盘交易时间内");
        return true;
    }
    
    // 检查夜盘（跨天情况）
    if (hour >= 20) {
        // 20:00 之后
        if (currentTime >= nightStart) {
            console.log("✅ 在夜盘交易时间内（20:00之后）");
            return true;
        }
    } else if (hour < 2 || (hour === 2 && minute <= 30)) {
        // 02:30 之前
        if (currentTime <= nightEnd) {
            console.log("✅ 在夜盘交易时间内（02:30之前）");
            return true;
        }
    }
    
    console.log("❌ 不在交易时间内");
    console.log(`日盘: ${dayStart}-${dayEnd}, 夜盘: ${nightStart}-次日${nightEnd}`);
    return false;
}

// 🔍 改进的数据有效性检查
function checkDataValidity(goldData, isTrading) {
    if (!goldData || !goldData.success || !goldData.allProducts) {
        console.log("❌ 数据基本结构无效");
        return false;
    }
    
    // 检查是否有任何品种有有效价格数据
    const hasAnyValidPrice = goldData.allProducts.some(item => hasValidPriceData(item));
    
    if (hasAnyValidPrice) {
        console.log("✅ 找到有效价格数据");
        return true;
    }
    
    // 如果没有有效价格数据，但在交易时间内，检查是否有其他有效字段
    if (isTrading) {
        const hasAnyValidData = goldData.allProducts.some(item => 
            item && item.variety && (item.latestpri || item.openpri || item.yespri)
        );
        
        if (hasAnyValidData) {
            console.log("⚠️ 交易时间内有部分数据，但价格数据可能异常");
            return true;
        }
    }
    
    console.log("❌ 无有效数据");
    return false;
}

// 📊 显示所有品种详细数据
async function displayAllProductsData(goldData, isRealTime = true) {
    if (!goldData.success || !goldData.allProducts) {
        console.log("无有效数据");
        return;
    }
    
    if (isRealTime) {
        console.log("## 所有黄金品种详细信息 (实时交易数据)");
    } else {
        console.log("## 所有黄金品种详细信息 (参考数据)");
    }
    console.log("");
    
    const allProducts = goldData.allProducts;
    
    // 按数据有效性排序：有数据的在前
    const sortedProducts = allProducts.sort((a, b) => {
        const aValid = hasValidPriceData(a);
        const bValid = hasValidPriceData(b);
        if (aValid && !bValid) return -1;
        if (!aValid && bValid) return 1;
        return 0;
    });
    
    let validCount = 0;
    let totalCount = 0;
    
    sortedProducts.forEach((product, index) => {
        const number = (index + 1).toString().padStart(2, '0');
        const riskIcon = getRiskIcon(getRiskLevel(product.variety));
        const description = getProductDescription(product.variety);
        
        console.log(`${number}. ${riskIcon} ${product.variety} - ${description}`);
        
        const hasValidPrice = hasValidPriceData(product);
        if (hasValidPrice) validCount++;
        totalCount++;
        
        if (hasValidPrice) {
            const latestPrice = formatNumber(product.latestpri);
            const limitChange = formatLimitChange(product.limit);
            const trendIcon = getTrendIcon(limitChange);
            const openPrice = formatNumber(product.openpri);
            const highPrice = formatNumber(product.maxpri);
            const lowPrice = formatNumber(product.minpri);
            const volume = formatVolume(product.totalvol);
            const updateTime = formatTime(product.time);
            const yesPrice = formatNumber(product.yespri);
            
            const changePoints = calculateChangePoints(product.latestpri, product.yespri);
            
            console.log(`最新价：${latestPrice}`);
            console.log(`涨跌：${changePoints} (${limitChange}) ${trendIcon}`);
            console.log(`今开：${openPrice} | 昨收：${yesPrice}`);
            console.log(`最高：${highPrice} | 最低：${lowPrice}`);
            console.log(`成交量：${volume}`);
            console.log(`更新时间：${updateTime}`);
            
            if (!isRealTime) {
                console.log(`⚠️ 非实时交易数据（市场已收盘）`);
            }
        } else {
            console.log(`无有效交易数据`);
            if (product.time) {
                console.log(`更新时间：${formatTime(product.time)}`);
            }
        }
        
        console.log("");
    });
    
    console.log(`📊 统计: ${validCount}/${totalCount} 个品种有有效价格数据`);
}

// 📊 显示所有品种无数据状态
async function displayAllProductsNoData(goldData) {
    const allProducts = goldData.allProducts || [];
    
    console.log("## 所有黄金品种状态");
    console.log("");
    
    const isTrading = isTradingTime(new Date());
    if (isTrading) {
        console.log("⚠️ 交易时间内但无有效数据");
        console.log("可能原因：数据源异常或网络问题");
    } else {
        console.log("所有品种当前均无交易数据");
        console.log("市场已收盘，等待下一个交易时段");
    }
    console.log("");
    
    allProducts.forEach((product, index) => {
        const number = (index + 1).toString().padStart(2, '0');
        const riskIcon = getRiskIcon(getRiskLevel(product.variety));
        const description = getProductDescription(product.variety);
        
        console.log(`${number}. ${riskIcon} ${product.variety} - ${description}`);
    });
    
    console.log("");
    console.log(`品种总数：${allProducts.length}`);
}

// 🔍 检查单个品种是否有有效价格数据
function hasValidPriceData(item) {
    if (!item || !item.latestpri) return false;
    
    const price = parseFloat(item.latestpri);
    // 放宽条件：只要价格是数字且大于0.1（避免0或极小值）
    return !isNaN(price) && price > 0.1;
}

// ⏰ 发送市场收盘通知（改进版）
async function sendMarketCloseNotification(currentTime, goldData = null) {
    const timeStr = currentTime.toLocaleString('zh-CN');
    const isTrading = isTradingTime(currentTime);
    
    let message = `⏰ ${timeStr}\n`;
    
    if (isTrading) {
        message += "🟡 市场状态: 交易中但数据异常\n\n";
        message += "⚠️ 当前在交易时间内，但数据获取异常\n\n";
    } else {
        message += "🔴 市场状态: 已收盘\n\n";
        message += "💤 当前市场已收盘，暂无实时交易数据\n\n";
    }
    
    message += "⏰ 交易时间:\n";
    message += "• 日盘: 09:00-15:30\n";
    message += "• 夜盘: 20:00-02:30\n\n";
    
    if (goldData && goldData.allProducts) {
        const validCount = goldData.allProducts.filter(item => hasValidPriceData(item)).length;
        const totalCount = goldData.allProducts.length;
        message += `📊 数据状态: ${validCount}/${totalCount} 个品种有参考数据\n\n`;
    }
    
    message += "🔄 下次更新: 交易时间自动更新";
    
    $notification.post(
        "🛎 上海黄金交易所",
        isTrading ? "数据获取异常" : "市场已收盘",
        message
    );
}

// ⚠️ 发送市场数据异常通知
async function sendMarketDataErrorNotification(currentTime, goldData) {
    const timeStr = currentTime.toLocaleString('zh-CN');
    const validCount = goldData.allProducts ? goldData.allProducts.filter(item => hasValidPriceData(item)).length : 0;
    const totalCount = goldData.allProducts ? goldData.allProducts.length : 0;
    
    let message = `⏰ ${timeStr}\n`;
    message += "🟡 市场状态: 交易中但数据异常\n\n";
    message += "⚠️ 当前在交易时间内，但数据获取异常\n\n";
    message += `📊 数据状态: ${validCount}/${totalCount} 个品种有效\n\n`;
    message += "可能原因:\n";
    message += "• 数据源暂时不可用\n";
    message += "• 网络连接问题\n";
    message += "• API限制或更新延迟\n\n";
    message += "🔄 系统将在下次更新时重试";
    
    $notification.post(
        "🛎 上海黄金交易所",
        "数据获取异常",
        message
    );
}

// 🔔 发送多个单独通知（只在交易时间内发送）
async function sendMultipleNotifications(currentTime, goldData) {
    const timeStr = currentTime.toLocaleString('zh-CN');
    const validProducts = (goldData.data || []).filter(item => hasValidPriceData(item));
    
    if (validProducts.length === 0) {
        console.log("⚠️ 没有有效的品种数据可以发送通知");
        await sendMarketDataErrorNotification(currentTime, goldData);
        return;
    }
    
    // 1. 市场状态通知
    let marketMessage = `⏰ ${timeStr}\n`;
    marketMessage += "🟢 市场状态: 交易中\n\n";
    marketMessage += "🛎 上海黄金交易所\n\n";
    marketMessage += "⏰ 交易时间:\n";
    marketMessage += "• 日盘: 09:00-15:30\n";
    marketMessage += "• 夜盘: 20:00-02:30\n\n";
    
    // 添加风险提示
    marketMessage += "📋 风险等级说明:\n";
    marketMessage += "🟢 低风险(现货)\n🟡 中风险(迷你)\n🔴 高风险(杠杆)\n🔴🔴 极高风险(白银)\n\n";
    marketMessage += `📊 当前 ${validProducts.length} 个品种有实时数据\n\n`;
    marketMessage += "🔄 自动更新: 每小时";
    
    $notification.post(
        "🛎 黄金市场概览",
        `交易中 • 实时行情`,
        marketMessage
    );
    
    // 等待1秒
    await delay(1000);
    
    // 2. 为目标品种发送单独通知
    for (let i = 0; i < validProducts.length; i++) {
        const item = validProducts[i];
        await sendProductNotification(item, i + 1, validProducts.length);
        
        // 如果不是最后一个通知，等待1秒
        if (i < validProducts.length - 1) {
            await delay(1000);
        }
    }
    
    // 3. 保存当前数据作为上一数据
    validProducts.forEach(item => {
        saveCurrentAsPrevious(item);
    });
}

// ... 其余函数保持不变（calculateChangePoints, getTrendIcon, getPreviousData, saveCurrentAsPrevious, calculatePriceChange, sendProductNotification, formatLimitChange, formatVolume, fetchGoldData, processApiData, getRiskLevel, getRiskIcon, getProductDescription, formatNumber, formatTime）

// 📈 计算涨跌点数
function calculateChangePoints(latestPrice, previousPrice) {
    if (!latestPrice || !previousPrice || latestPrice === "--" || previousPrice === "--") {
        return "--";
    }
    
    const current = parseFloat(latestPrice);
    const previous = parseFloat(previousPrice);
    
    if (isNaN(current) || isNaN(previous)) {
        return "--";
    }
    
    const change = current - previous;
    return (change > 0 ? "+" : "") + change.toFixed(2);
}

// 📈 获取趋势图标
function getTrendIcon(limitChange) {
    if (limitChange === '--' || limitChange === 'NaN%') return "";
    const changeValue = parseFloat(limitChange);
    if (isNaN(changeValue)) return "";
    return changeValue > 0 ? "🔺" : changeValue < 0 ? "🔻" : "";
}

// 💾 获取上一数据
function getPreviousData(variety) {
    const previousKey = `gold_previous_${variety}`;
    const previousData = $persistentStore.read(previousKey);
    
    if (previousData) {
        try {
            return JSON.parse(previousData);
        } catch (e) {
            console.log(`解析上一数据失败: ${e}`);
        }
    }
    
    return null;
}

// 💾 保存当前数据为上一数据
function saveCurrentAsPrevious(item) {
    if (!item || !item.variety) return;
    
    const latestPrice = parseFloat(item.latestpri);
    if (isNaN(latestPrice) || latestPrice <= 0) return;
    
    const previousData = {
        price: formatNumber(item.latestpri),
        change: item.limit || "--",
        time: new Date().toLocaleTimeString('zh-CN'),
        timestamp: Date.now()
    };
    
    const previousKey = `gold_previous_${item.variety}`;
    $persistentStore.write(JSON.stringify(previousData), previousKey);
}

// 📊 计算价格变化
function calculatePriceChange(currentPrice, previousPrice) {
    if (!currentPrice || !previousPrice || currentPrice === "--" || previousPrice === "--") {
        return { value: "--", icon: "➖" };
    }
    
    const current = parseFloat(currentPrice);
    const previous = parseFloat(previousPrice);
    
    if (isNaN(current) || isNaN(previous) || previous === 0) {
        return { value: "--", icon: "➖" };
    }
    
    const change = ((current - previous) / previous) * 100;
    const changeValue = change.toFixed(2) + '%';
    const changeIcon = change > 0 ? "📈" : change < 0 ? "📉" : "➖";
    
    return {
        value: (change > 0 ? '+' : '') + changeValue,
        icon: changeIcon
    };
}

// 🔔 发送单个品种通知
async function sendProductNotification(item, currentIndex, totalCount) {
    const riskLevel = getRiskLevel(item.variety);
    const description = getProductDescription(item.variety);
    const riskIcon = getRiskIcon(riskLevel);
    
    // 处理可能的数据异常
    const latestPrice = formatNumber(item.latestpri);
    const limitChange = formatLimitChange(item.limit);
    const openPrice = formatNumber(item.openpri);
    const highPrice = formatNumber(item.maxpri);
    const lowPrice = formatNumber(item.minpri);
    const volume = item.totalvol || "--";
    
    // 判断趋势
    const trendIcon = getTrendIcon(limitChange);
    
    // 获取上一数据
    const previousData = getPreviousData(item.variety);
    let previousPrice = "--";
    let previousTime = "--";
    let changeFromPrevious = { value: "--", icon: "➖" };
    
    if (previousData) {
        previousPrice = previousData.price;
        previousTime = previousData.time;
        changeFromPrevious = calculatePriceChange(latestPrice, previousPrice);
    }
    
    let message = `${riskIcon} ${item.variety} (${description})\n\n`;
    
    // 实时数据
    message += "📊 实时行情:\n";
    message += `💰 最新价格: ${latestPrice} ${trendIcon}\n`;
    message += `📈 涨跌幅: ${limitChange}\n`;
    message += `🔼 开盘: ${openPrice}\n`;
    message += `🔼 最高: ${highPrice}\n`;
    message += `🔽 最低: ${lowPrice}\n`;
    message += `📊 成交量: ${volume}\n\n`;
    
    // 上一数据
    message += "📊 上一数据:\n";
    message += `💰 价格: ${previousPrice}\n`;
    message += `${changeFromPrevious.icon} 变化: ${changeFromPrevious.value}\n`;
    message += `⏰ 时间: ${previousTime}\n\n`;
    
    message += `⏰ 本次更新: ${formatTime(item.time)}\n`;
    message += `📱 ${currentIndex}/${totalCount}`;
    
    $notification.post(
        "🛎 黄金行情",
        `${item.variety} ${latestPrice} ${trendIcon}`,
        message
    );
}

// 📈 专门处理涨跌幅数据
function formatLimitChange(limit) {
    if (!limit || limit === '--') return '--';
    
    // 处理NaN%的情况
    if (limit === 'NaN%' || limit.includes('NaN')) {
        return '--';
    }
    
    // 尝试解析数字
    const num = parseFloat(limit);
    if (isNaN(num)) {
        return '--';
    }
    
    // 返回带符号的百分比
    return (num >= 0 ? '+' : '') + num.toFixed(2) + '%';
}

// 🔢 格式化成交量
function formatVolume(volume) {
    if (!volume || volume === '--' || volume === 'NaN') return '--';
    
    const num = parseFloat(volume);
    if (isNaN(num)) return '--';
    
    if (num >= 1000000) {
        return (num / 1000000).toFixed(2) + '万手';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(2) + '千手';
    }
    
    return num.toFixed(0) + '手';
}

// 🌐 获取黄金数据
function fetchGoldData() {
    return new Promise((resolve) => {
        const url = `${API_URL}?key=${API_KEY}&v=1`;
        
        $httpClient.get(url, (error, response, data) => {
            if (error) {
                console.log("请求错误: " + error);
                resolve({success: false, error: error});
                return;
            }
            
            try {
                const result = JSON.parse(data);
                
                if (result.error_code === 0) {
                    // 处理API数据，获取所有品种
                    const processedData = processApiData(result.result);
                    
                    resolve({
                        success: true, 
                        data: processedData.filteredData,
                        allProducts: processedData.allProducts,
                        resultCount: processedData.resultCount,
                        reason: result.reason
                    });
                } else {
                    console.log(`API错误: ${result.reason} (代码: ${result.error_code})`);
                    resolve({
                        success: false, 
                        error: result.reason,
                        errorCode: result.error_code
                    });
                }
            } catch (e) {
                console.log("数据解析错误: " + e);
                resolve({
                    success: false,
                    error: "数据解析失败: " + e
                });
            }
        });
    });
}

// 🔧 处理API数据 - 返回所有品种
function processApiData(apiResult) {
    if (!apiResult) return { allProducts: [], filteredData: [], resultCount: 0 };
    
    let allProducts = [];
    let resultCount = 0;
    
    console.log(`获取到 ${Array.isArray(apiResult) ? apiResult.length : 0} 个结果元素`);
    
    // API返回的是一个数组，但第一个元素是一个包含所有品种的大对象
    if (Array.isArray(apiResult) && apiResult.length > 0) {
        resultCount = apiResult.length;
        const firstItem = apiResult[0];
        
        if (typeof firstItem === 'object') {
            // 提取对象中的所有值
            Object.values(firstItem).forEach(item => {
                if (item && typeof item === 'object' && item.variety) {
                    allProducts.push(item);
                }
            });
        }
        
        console.log(`处理第 1 个结果元素，包含 ${allProducts.length} 个品种`);
    }
    
    // 只修正明显错误的品种名称，不进行去重
    const nameCorrections = {
        "MAUTD": "mAu(T+D)" // 只修正这个明显的错误
    };
    
    // 应用名称修正
    allProducts.forEach(product => {
        if (nameCorrections[product.variety]) {
            product.variety = nameCorrections[product.variety];
        }
    });
    
    // 个人投资者关注的品种（用于通知）
    const targetProducts = ["Au99.99", "Au100g", "PGC30g", "Au(T+D)", "mAu(T+D)", "Ag(T+D)"];
    
    const filteredData = allProducts.filter(item => 
        targetProducts.includes(item.variety)
    );
    
    return {
        allProducts: allProducts,
        filteredData: filteredData,
        resultCount: resultCount
    };
}

// 🎯 风险等级
function getRiskLevel(variety) {
    const riskMap = {
        "Au99.99": "low",        // 低风险 - 标准现货黄金
        "Au100g": "low",         // 低风险 - 小规格金条
        "PGC30g": "low",         // 低风险 - 熊猫金币
        "mAu(T+D)": "medium",    // 中风险 - 迷你黄金
        "Au(T+D)": "high",       // 高风险 - 黄金延期
        "Ag(T+D)": "very-high",  // 极高风险 - 白银延期
        "AU99.99": "low"         // 低风险 - 添加大写版本的品种
    };
    return riskMap[variety] || "medium";
}

// 🎯 风险图标
function getRiskIcon(riskLevel) {
    const iconMap = {
        "low": "🟢",         // 低风险 - 绿色
        "medium": "🟡",      // 中风险 - 黄色
        "high": "🔴",        // 高风险 - 红色
        "very-high": "🔴"    // 极高风险 - 红色
    };
    return iconMap[riskLevel] || "🟡";
}

// 📝 品种描述 - 扩展所有品种的中文注释
function getProductDescription(variety) {
    const descriptions = {
        "Au99.99": "标准现货黄金",    // 主要现货品种
        "Au100g": "小规格金条",       // 小克重投资金条
        "PGC30g": "熊猫金币",         // 纪念金币品种
        "Au(T+D)": "黄金延期",        // 保证金交易品种
        "mAu(T+D)": "迷你黄金",       // 小合约黄金
        "Ag(T+D)": "白银延期",        // 白银延期交易
        "AU99.99": "标准现货黄金",     // 大写版本
        "Au99.95": "标准二号金",      // 其他黄金品种
        "Au(T+N1)": "黄金延期一月",    // 月度合约
        "Au(T+N2)": "黄金延期二月",    // 双月合约
        "Au50g": "50克金条",         // 小规格品种
        "Ag99.99": "标准现货白银",    // 现货白银
        "Pt99.95": "铂金99.95",      // 铂金品种
        "AU995": "标准一号金",        // 高纯度黄金
        "iAu99.99": "国际版黄金",     // 国际板品种
        "IAU100G": "国际版100克金",   // 国际板小条
        "IAU99.5": "国际版黄金99.5"   // 国际板标准金
    };
    return descriptions[variety] || "贵金属投资";
}

// 🔢 格式化数字
function formatNumber(value) {
    if (!value || value === '--' || value === 'NaN' || value === '—' || value === '-') return '--';
    const num = parseFloat(value);
    return isNaN(num) ? '--' : num.toFixed(2);
}

// ⏰ 格式化时间
function formatTime(timeStr) {
    if (!timeStr) return '--';
    return timeStr.split(' ')[1] || timeStr;
}