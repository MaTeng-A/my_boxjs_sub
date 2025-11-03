// 上海黄金交易所数据脚本 - 快速检查版
// 先检查数据有效性，再决定是否发送后续通知

const API_KEY = "f24e2fa4068b20c4d44fbff66b7745de";
const API_URL = "http://web.juhe.cn/finance/gold/shgold";

// Loon兼容延迟函数
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
    try {
        console.log("开始获取黄金数据...");
        
        const now = new Date();
        const goldData = await fetchGoldData();
        
        // 快速检查数据有效性
        const hasValidData = quickDataCheck(goldData);
        console.log(`当前时间: ${now.toLocaleString('zh-CN')}`);
        console.log(`数据有效性: ${hasValidData ? '有有效数据' : '无有效数据'}`);
        
        if (hasValidData) {
            // 有数据：发送多个单独通知
            await sendMultipleNotifications(now, goldData);
            console.log("所有通知发送完成");
        } else {
            // 无数据：只发送市场收盘通知
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

// 快速数据检查
function quickDataCheck(apiData) {
    if (!apiData || !apiData.success || !apiData.data || apiData.data.length === 0) {
        console.log("快速检查: 无数据或数据获取失败");
        return false;
    }
    
    // 快速检查：只要有一个品种有有效价格数据
    for (let i = 0; i < apiData.data.length; i++) {
        const item = apiData.data[i];
        const price = parseFloat(item.latestpri);
        if (!isNaN(price) && price > 0) {
            console.log("快速检查: 发现有效数据");
            return true;
        }
    }
    
    console.log("快速检查: 无有效价格数据");
    return false;
}

// 发送市场收盘通知
async function sendMarketCloseNotification(currentTime) {
    const timeStr = currentTime.toLocaleString('zh-CN');
    
    let message = `⏰ ${timeStr}\n`;
    message += "🔴 市场状态: 已收盘\n\n";
    message += "💤 当前市场已收盘，暂无交易数据\n\n";
    message += "⏰ 交易时间:\n";
    message += "• 日盘: 09:00-15:30\n";
    message += "• 夜盘: 20:00-02:30\n\n";
    message += "🔄 下次更新: 交易时间自动更新";
    
    $notification.post(
        "🛎 上海黄金交易所",
        "市场已收盘",
        message
    );
    
    console.log("市场收盘通知已发送");
}

// 发送多个单独通知
async function sendMultipleNotifications(currentTime, apiData) {
    const timeStr = currentTime.toLocaleString('zh-CN');
    
    // 1. 市场状态通知
    let marketMessage = `⏰ ${timeStr}\n`;
    marketMessage += "🟢 市场状态: 交易中\n\n";
    marketMessage += "🛎 上海黄金交易所\n\n";
    marketMessage += "⏰ 交易时间:\n";
    marketMessage += "• 日盘: 09:00-15:30\n";
    message += "• 夜盘: 20:00-02:30\n\n";
    
    // 添加风险提示
    marketMessage += "📋 风险等级说明:\n";
    marketMessage += "🟢 低风险(现货)\n🟡 中风险(迷你)\n🔴 高风险(杠杆)\n🔴🔴 极高风险(白银)\n\n";
    marketMessage += "🔄 自动更新: 每小时";
    
    $notification.post(
        "🛎 黄金市场概览",
        `交易中 • 实时行情`,
        marketMessage
    );
    
    console.log("市场状态通知已发送");
    
    // 等待1秒
    await delay(1000);
    
    // 2. 为每个品种发送单独通知
    for (let i = 0; i < apiData.data.length; i++) {
        const item = apiData.data[i];
        await sendProductNotification(item, i + 1, apiData.data.length);
        
        // 如果不是最后一个通知，等待1秒
        if (i < apiData.data.length - 1) {
            await delay(1000);
        }
    }
    
    // 3. 保存当前数据作为上一数据
    apiData.data.forEach(item => {
        saveCurrentAsPrevious(item);
    });
    
    console.log("所有品种通知发送完成");
}

// 获取上一数据
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

// 保存当前数据为上一数据
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
    console.log(`已保存 ${item.variety} 的上一数据`);
}

// 计算价格变化
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

// 发送单个品种通知
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
    
    // 判断趋势（如果有有效数据）
    let trendIcon = "➖"; // 默认中性
    if (limitChange !== '--' && limitChange !== 'NaN%') {
        const changeValue = parseFloat(limitChange);
        if (!isNaN(changeValue)) {
            trendIcon = changeValue < 0 ? "🔻" : "🔺";
        }
    }
    
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
    message += `🔽 最低: ${lowPrice}\n\n`;
    
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
    
    console.log(`品种通知已发送: ${item.variety} (${currentIndex}/${totalCount})`);
}

// 专门处理涨跌幅数据
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

// 获取黄金数据
function fetchGoldData() {
    return new Promise((resolve) => {
        const url = `${API_URL}?key=${API_KEY}&v=1`;
        console.log("请求URL: " + url);
        
        $httpClient.get(url, (error, response, data) => {
            if (error) {
                console.log("请求错误: " + error);
                resolve({success: false, error: error});
                return;
            }
            
            try {
                console.log("API响应状态: " + response.status);
                const result = JSON.parse(data);
                
                if (result.error_code === 0) {
                    console.log("API返回数据成功");
                    
                    // 处理异常数据格式
                    const processedData = processApiData(result.result);
                    console.log("处理后的数据条数: "+ processedData.length);
                    
                    resolve({
                        success: true, 
                        data: processedData,
                        reason: result.reason
                    });
                } else {
                    console.log(`API错误: ${result.reason} (${result.error_code})`);
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

// 处理API数据
function processApiData(apiResult) {
    if (!apiResult) return [];
    
    console.log("原始API结果类型: " + typeof apiResult);
    
    let allProducts = [];
    
    // API返回的是一个数组，但第一个元素是一个包含所有品种的大对象
    if (Array.isArray(apiResult) && apiResult.length > 0) {
        const firstItem = apiResult[0];
        
        if (typeof firstItem === 'object') {
            // 提取对象中的所有值
            Object.values(firstItem).forEach(item => {
                if (item && typeof item === 'object' && item.variety) {
                    allProducts.push(item);
                }
            });
        }
    }
    
    console.log("提取到的总品种数: " + allProducts.length);
    
    // 修正品种名称映射
    const nameCorrections = {
        "Aug9.99": "Au99.99",
        "Aug9.95": "Au99.95", 
        "MAUTD": "mAu(T+D)",
        "Ag(7+D)": "Ag(T+D)",
        "Au(7+D)": "Au(T+D)",
        "Au1000": "Au100g"
    };
    
    // 应用名称修正
    allProducts.forEach(product => {
        if (nameCorrections[product.variety]) {
            console.log(`修正品种名称: ${product.variety} -> ${nameCorrections[product.variety]}`);
            product.variety = nameCorrections[product.variety];
        }
    });
    
    // 个人投资者关注的品种
    const targetProducts = ["Au99.99", "Au100g", "PGC30g", "Au(T+D)", "mAu(T+D)", "Ag(T+D)"];
    
    const filteredData = allProducts.filter(item => 
        targetProducts.includes(item.variety)
    );
    
    console.log("过滤后的关注品种数: " + filteredData.length);
    
    return filteredData;
}

// 风险等级
function getRiskLevel(variety) {
    const riskMap = {
        "Au99.99": "low",
        "Au100g": "low", 
        "PGC30g": "low",
        "mAu(T+D)": "medium",
        "Au(T+D)": "high",
        "Ag(T+D)": "very-high"
    };
    return riskMap[variety] || "medium";
}

// 风险图标
function getRiskIcon(riskLevel) {
    const iconMap = {
        "low": "🟢",
        "medium": "🟡", 
        "high": "🔴",
        "very-high": "🔴🔴"
    };
    return iconMap[riskLevel] || "🟡";
}

// 品种描述
function getProductDescription(variety) {
    const descriptions = {
        "Au99.99": "标准现货黄金",
        "Au100g": "小规格金条", 
        "PGC30g": "熊猫金币",
        "Au(T+D)": "黄金延期",
        "mAu(T+D)": "迷你黄金",
        "Ag(T+D)": "白银延期"
    };
    return descriptions[variety] || "贵金属投资";
}

// 格式化数字
function formatNumber(value) {
    if (!value || value === '--' || value === 'NaN') return '--';
    const num = parseFloat(value);
    return isNaN(num) ? '--' : num.toFixed(2);
}

// 格式化时间
function formatTime(timeStr) {
    if (!timeStr) return '--';
    return timeStr.split(' ')[1] || timeStr;
}