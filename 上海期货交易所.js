// 期货监控脚本 for Loon - 每小时运行版
const API_URL = "http://web.juhe.cn/finance/gold/shfuture";
const APP_KEY = "f24e2fa4068b20c4d44fbff66b7745de";

// 期货交易时间配置
const FUTURES_TRADING_HOURS = {
    day: {
        sessions: [
            { start: { hour: 9, minute: 0 }, end: { hour: 10, minute: 15 } },    // 第一节
            { start: { hour: 10, minute: 30 }, end: { hour: 11, minute: 30 } },   // 第二节
            { start: { hour: 13, minute: 30 }, end: { hour: 15, minute: 0 } }     // 第三节
        ]
    },
    night: {
        sessions: [
            { start: { hour: 21, minute: 0 }, end: { hour: 23, minute: 0 } },     // 标准夜盘
            { start: { hour: 21, minute: 0 }, end: { hour: 1, minute: 0 } },      // 金属夜盘（到次日1点）
            { start: { hour: 21, minute: 0 }, end: { hour: 2, minute: 30 } }      // 金银原油夜盘（到次日2:30）
        ]
    }
};

// 存储上次数据用于比较
let lastData = $persistentStore.read("futures_last_data");
if (!lastData) {
    lastData = {};
} else {
    lastData = JSON.parse(lastData);
}

function main() {
    console.log("🎯 开始获取期货数据...");
    
    const now = new Date();
    console.log(`🕒 当前时间: ${now.toLocaleString('zh-CN')}`);
    
    // 检查是否在交易时间内
    const isTrading = isFuturesTradingTime(now);
    console.log(`📊 交易状态: ${isTrading ? '交易中' : '非交易时间'}`);
    
    const url = `${API_URL}?key=${APP_KEY}&v=1`;
    
    $httpClient.get({
        url: url,
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        timeout: 10000
    }, (error, response, data) => {
        if (error) {
            console.log("❌ 请求失败:", error);
            $notification.post(
                "📊 期货数据", 
                "网络请求失败", 
                "无法连接到期货数据接口\n请检查网络连接"
            );
            $done();
            return;
        }
        
        try {
            const jsonData = JSON.parse(data);
            
            if (jsonData.error_code !== 0) {
                console.log("❌ API错误:", jsonData.reason, "代码:", jsonData.error_code);
                $notification.post(
                    "📊 期货数据", 
                    "API接口错误", 
                    `错误原因: ${jsonData.reason}\n错误代码: ${jsonData.error_code}`
                );
                $done();
                return;
            }
            
            if (!jsonData.result || !Array.isArray(jsonData.result)) {
                console.log("❌ API返回数据格式异常");
                $notification.post(
                    "📊 期货数据", 
                    "数据格式异常", 
                    "API返回数据格式不正确\n请稍后重试"
                );
                $done();
                return;
            }
            
            // 处理期货数据
            processFuturesData(jsonData.result, isTrading);
            
        } catch (e) {
            console.log("❌ 数据处理错误:", e);
            $notification.post(
                "📊 期货数据", 
                "数据处理错误", 
                "解析数据时发生错误\n请检查脚本配置"
            );
        }
        
        $done();
    });
}

// ⏰ 检查期货交易时间
function isFuturesTradingTime(now) {
    const dayOfWeek = now.getDay();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentMinutes = hour * 60 + minute;
    
    // 周末休市
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        return false;
    }
    
    // 检查日盘交易时间
    for (const session of FUTURES_TRADING_HOURS.day.sessions) {
        const sessionStart = session.start.hour * 60 + session.start.minute;
        const sessionEnd = session.end.hour * 60 + session.end.minute;
        
        if (currentMinutes >= sessionStart && currentMinutes <= sessionEnd) {
            return true;
        }
    }
    
    // 检查夜盘交易时间（跨天）
    for (const session of FUTURES_TRADING_HOURS.night.sessions) {
        const sessionStart = session.start.hour * 60 + session.start.minute;
        let sessionEnd = session.end.hour * 60 + session.end.minute;
        
        // 处理跨天的夜盘（结束时间在次日）
        if (session.end.hour < session.start.hour) {
            sessionEnd += 24 * 60; // 加上一天的分钟数
        }
        
        let adjustedCurrentMinutes = currentMinutes;
        if (hour < session.start.hour) {
            adjustedCurrentMinutes += 24 * 60; // 如果是凌晨，加上一天的分钟数
        }
        
        if (adjustedCurrentMinutes >= sessionStart && adjustedCurrentMinutes <= sessionEnd) {
            return true;
        }
    }
    
    return false;
}

function processFuturesData(resultArray, isTrading) {
    console.log(`📊 获取到 ${resultArray.length} 个结果元素`);
    
    if (resultArray.length === 0) {
        console.log("❌ 结果数组为空");
        sendMarketCloseNotification();
        return;
    }
    
    // 提取所有期货品种
    const allFutures = [];
    
    resultArray.forEach((item, index) => {
        console.log(`🔍 处理第 ${index + 1} 个结果元素，包含 ${Object.keys(item).length} 个品种`);
        
        // 遍历该元素中的所有品种
        Object.keys(item).forEach(futureKey => {
            const futureData = item[futureKey];
            if (futureData && futureData.name && futureData.latestpri) {
                allFutures.push({
                    key: futureKey,
                    data: futureData
                });
            }
        });
    });
    
    console.log(`📈 总共提取到 ${allFutures.length} 个有效期货品种`);
    
    if (allFutures.length === 0) {
        console.log("⚠️ 没有有效数据");
        sendMarketCloseNotification();
        return;
    }
    
    // 检查数据时间有效性（只在交易时间内检查）
    let validFutures = allFutures;
    if (isTrading) {
        validFutures = allFutures.filter(future => {
            return isDataTimeValid(future.data.time);
        });
        console.log(`🕒 时间有效的品种: ${validFutures.length}/${allFutures.length}`);
    } else {
        console.log("⏰ 非交易时间，跳过数据时间验证");
    }
    
    if (validFutures.length === 0) {
        console.log("⚠️ 没有有效的数据");
        if (isTrading) {
            sendMarketDataErrorNotification();
        } else {
            sendMarketCloseNotification();
        }
        return;
    }
    
    // 显示所有品种的详细信息
    displayAllFuturesDetails(validFutures, isTrading);
    
    // 发送通知
    if (isTrading) {
        sendMainFuturesNotifications(validFutures);
    } else {
        sendMarketCloseNotification(validFutures);
    }
}

function displayAllFuturesDetails(futuresList, isTrading) {
    console.log("=".repeat(80));
    if (isTrading) {
        console.log("📋 所有期货品种详细信息 (交易中)");
    } else {
        console.log("📋 所有期货品种详细信息 (非交易时间)");
    }
    console.log("=".repeat(80));
    
    futuresList.forEach((future, index) => {
        const data = future.data;
        const changePercent = calculateChangePercent(data.latestpri, data.lastclear, data.change);
        const changeNum = parseFloat(data.change);
        const arrow = isNaN(changeNum) ? "➡️" : (changeNum >= 0 ? "📈" : "📉");
        
        // 品种标题行
        console.log(`${arrow} ${(index + 1).toString().padStart(2, '0')}. ${future.key}`);
        
        // 最新价单独一行
        console.log(`   💰 最新价: ${data.latestpri}`);
        
        // 涨跌和涨跌幅在同一行
        console.log(`   📊 涨跌: ${data.change} (${changePercent})`);
        
        // 买卖盘信息在同一行
        console.log(`   🛒 买价: ${data.buypri || "N/A"} (${data.buyvol || "N/A"}手) | 🏪 卖价: ${data.sellpri || "N/A"} (${data.sellvol || "N/A"}手)`);
        
        // 开盘和结算信息
        console.log(`   📈 今开: ${data.open || "N/A"} | 📉 昨结: ${data.lastclear || "N/A"}`);
        
        // 最高最低价
        console.log(`   🔺 最高: ${data.maxpri || "N/A"} | 🔻 最低: ${data.minpri || "N/A"}`);
        
        // 成交量和持仓量
        console.log(`   📦 成交量: ${data.tradvol || "N/A"}手 | 🏷️ 持仓量: ${data.position || "N/A"}手`);
        
        // 增仓信息（如果有）
        if (data.zengcang && data.zengcang !== "") {
            console.log(`   📋 增仓: ${data.zengcang}手`);
        }
        
        // 更新时间
        console.log(`   🕒 更新时间: ${data.time}`);
        
        // 非交易时间提示
        if (!isTrading) {
            console.log(`   ⚠️ 注意: 非实时交易数据`);
        }
        
        // 品种间分隔线
        if (index < futuresList.length - 1) {
            console.log("─".repeat(80));
        }
    });
    
    console.log("=".repeat(80));
    console.log(`📊 总计 ${futuresList.length} 个期货品种`);
}

// ⏰ 发送市场收盘通知
function sendMarketCloseNotification(futuresList = []) {
    const now = new Date();
    const timeStr = now.toLocaleString('zh-CN');
    
    let message = `⏰ ${timeStr}\n`;
    message += "🔴 市场状态: 已收盘\n\n";
    message += "💤 当前期货市场已收盘，暂无实时交易数据\n\n";
    message += "⏰ 期货交易时间:\n";
    message += "• 日盘: 09:00-10:15, 10:30-11:30, 13:30-15:00\n";
    message += "• 夜盘: 21:00-23:00 (部分品种至次日1:00或2:30)\n\n";
    message += "📅 交易日: 周一至周五\n";
    message += "🔄 下次更新: 交易时间自动更新";
    
    if (futuresList.length > 0) {
        message += `\n\n📊 当前显示 ${futuresList.length} 个品种的参考数据`;
    }
    
    $notification.post(
        "📊 期货市场",
        "市场已收盘",
        message
    );
    
    console.log("✅ 市场收盘通知已发送");
}

// ⚠️ 发送市场数据异常通知
function sendMarketDataErrorNotification() {
    const now = new Date();
    const timeStr = now.toLocaleString('zh-CN');
    
    let message = `⏰ ${timeStr}\n`;
    message += "🟡 市场状态: 交易中但数据异常\n\n";
    message += "⚠️ 当前在交易时间内，但未能获取到有效实时数据\n\n";
    message += "可能原因:\n";
    message += "• 数据源暂时不可用\n";
    message += "• 网络连接问题\n";
    message += "• API限制\n\n";
    message += "🔄 系统将在下次更新时重试";
    
    $notification.post(
        "📊 期货数据",
        "数据获取异常",
        message
    );
    
    console.log("✅ 数据异常通知已发送");
}

function isDataTimeValid(dataTime) {
    if (!dataTime) return false;
    
    const dataDate = new Date(dataTime.replace(/-/g, '/'));
    const now = new Date();
    
    // 检查数据时间是否在最近30分钟内
    const timeDiff = (now - dataDate) / (1000 * 60);
    
    if (timeDiff > 30) {
        console.log(`⏰ 数据时间已过期: ${dataTime} (${timeDiff.toFixed(1)}分钟前)`);
        return false;
    }
    
    return true;
}

function calculateChangePercent(latest, lastClear, change) {
    if (!latest || !lastClear) return "N/A";
    
    const latestNum = parseFloat(latest);
    const lastClearNum = parseFloat(lastClear);
    
    if (isNaN(latestNum) || isNaN(lastClearNum) || lastClearNum === 0) {
        return "N/A";
    }
    
    if (change) {
        const changeNum = parseFloat(change);
        if (!isNaN(changeNum)) {
            const percent = (changeNum / lastClearNum) * 100;
            return (percent >= 0 ? "+" : "") + percent.toFixed(2) + "%";
        }
    }
    
    const percent = ((latestNum - lastClearNum) / lastClearNum) * 100;
    return (percent >= 0 ? "+" : "") + percent.toFixed(2) + "%";
}

function sendMainFuturesNotifications(futuresList) {
    // 筛选主力合约
    const mainFutures = futuresList.filter(future => 
        future.key.includes("连续")
    );
    
    console.log(`🎯 找到 ${mainFutures.length} 个主力合约`);
    
    if (mainFutures.length === 0) {
        console.log("⚠️ 未找到主力合约，发送前2个品种");
        sendLimitedNotifications(futuresList.slice(0, 2));
        return;
    }
    
    sendLimitedNotifications(mainFutures);
}

function sendLimitedNotifications(futuresList) {
    let notifiedCount = 0;
    const maxNotifications = 2;
    
    const currentData = {};
    
    futuresList.slice(0, maxNotifications).forEach((future, index) => {
        const futureKey = future.key;
        const futureData = future.data;
        
        currentData[futureKey] = JSON.stringify(futureData);
        
        try {
            sendSingleFutureNotification(futureKey, futureData);
            notifiedCount++;
        } catch (error) {
            console.log(`❌ 发送通知失败 [${futureKey}]:`, error);
        }
    });
    
    Object.assign(lastData, currentData);
    $persistentStore.write(JSON.stringify(lastData), "futures_last_data");
    
    console.log(`✅ 处理完成: 发送 ${notifiedCount} 个通知`);
}

function sendSingleFutureNotification(futureKey, data) {
    const name = data.name || futureKey;
    const latestPrice = data.latestpri || "N/A";
    const change = data.change || "0";
    const open = data.open || "N/A";
    const high = data.maxpri || "N/A";
    const low = data.minpri || "N/A";
    const volume = data.tradvol || "N/A";
    const lastClose = data.lastclear || "N/A";
    const buyPrice = data.buypri || "N/A";
    const buyVolume = data.buyvol || "N/A";
    const sellPrice = data.sellpri || "N/A";
    const sellVolume = data.sellvol || "N/A";
    const position = data.position || "N/A";
    const zengcang = data.zengcang || "N/A";
    const time = data.time || "未知";
    
    const dataFreshness = calculateDataFreshness(time);
    const changePercent = calculateChangePercent(latestPrice, lastClose, change);
    
    const changeNum = parseFloat(change);
    const arrow = isNaN(changeNum) ? "➡️" : (changeNum >= 0 ? "📈" : "📉");
    const changeText = isNaN(changeNum) ? change : (changeNum >= 0 ? `+${change}` : change);
    
    const title = `${arrow} ${name}`;
    const subtitle = `🕒 ${time.split(' ')[1]} • ${dataFreshness}`;
    
    let message = "";
    message += `💰 最新价: ${latestPrice}\n`;
    message += `📊 涨跌: ${changeText}`;
    if (changePercent !== "N/A") message += ` (${changePercent})`;
    message += `\n🛒 买盘: ${buyPrice} (${buyVolume}手)`;
    message += `\n🏪 卖盘: ${sellPrice} (${sellVolume}手)`;
    message += `\n📈 今开: ${open}`;
    if (lastClose !== "N/A") message += ` | 昨结: ${lastClose}`;
    message += `\n🎯 高低: ${high}/${low}`;
    if (volume !== "N/A") message += `\n📦 成交量: ${volume}手`;
    if (position !== "N/A") message += ` | 持仓: ${position}手`;
    if (zengcang !== "N/A" && zengcang !== "") message += `\n📋 增仓: ${zengcang}手`;
    
    if (dataFreshness.includes("前")) {
        message += `\n\n⚠️ 注意: 非实时交易数据`;
    }
    
    console.log(`📤 发送通知: ${name}`);
    $notification.post(title, subtitle, message);
}

function calculateDataFreshness(dataTime) {
    if (!dataTime) return "时间未知";
    
    const dataDate = new Date(dataTime.replace(/-/g, '/'));
    const now = new Date();
    const timeDiff = (now - dataDate) / (1000 * 60);
    
    if (timeDiff < 1) {
        return "刚刚更新";
    } else if (timeDiff < 60) {
        return `${Math.floor(timeDiff)}分钟前`;
    } else {
        return `${Math.floor(timeDiff / 60)}小时前`;
    }
}

// 执行主函数
main();