// 名称: 苹果天气后台请求监听器
// 描述: 专门监控后台天气请求，分析定位信息
// 作者: Assistant

const DEBUG = true;  // 开启详细日志

// 判断是否可能是后台请求
function isBackgroundRequest(request) {
    const backgroundIndicators = [
        'background',
        'refresh',
        'update',
        'fetch',
        'widget',
        'notification'
    ];
    
    const url = request.url.toLowerCase();
    const referer = (request.headers['Referer'] || '').toLowerCase();
    const userAgent = (request.headers['User-Agent'] || '').toLowerCase();
    
    // 检查URL中的后台标识
    for (const indicator of backgroundIndicators) {
        if (url.includes(indicator)) return true;
    }
    
    // 检查User-Agent中的后台标识
    if (userAgent.includes('background') || 
        userAgent.includes('widget') || 
        userAgent.includes('extension')) {
        return true;
    }
    
    // 检查请求时间（后台请求通常在特定时间）
    const hour = new Date().getHours();
    if (hour >= 0 && hour <= 5) {
        return true; // 凌晨时段的请求很可能是后台更新
    }
    
    return false;
}

// 提取GPS定位信息
function extractGPSInfo(url, headers) {
    const gpsInfo = {
        hasGPS: false,
        latitude: null,
        longitude: null,
        accuracy: null,
        source: null,
        format: null
    };
    
    // 1. 从URL参数中提取
    const urlObj = new URL(url);
    
    // 检查常见定位参数
    const gpsPatterns = [
        { pattern: /[?&]lat=([-0-9.]+)/i, key: 'latitude' },
        { pattern: /[?&]latitude=([-0-9.]+)/i, key: 'latitude' },
        { pattern: /[?&]lon=([-0-9.]+)/i, key: 'longitude' },
        { pattern: /[?&]lng=([-0-9.]+)/i, key: 'longitude' },
        { pattern: /[?&]longitude=([-0-9.]+)/i, key: 'longitude' },
        { pattern: /[?&]acc=([0-9.]+)/i, key: 'accuracy' },
        { pattern: /[?&]accuracy=([0-9.]+)/i, key: 'accuracy' },
    ];
    
    gpsPatterns.forEach(pattern => {
        const match = url.match(pattern.pattern);
        if (match) {
            gpsInfo[pattern.key] = parseFloat(match[1]);
            gpsInfo.hasGPS = true;
            gpsInfo.source = 'URL参数';
            gpsInfo.format = '显式坐标';
        }
    });
    
    // 2. 从路径中提取（如：/weather/37.7749,-122.4194/）
    const pathPattern = /\/[-0-9.]+\,[-0-9.]+\//;
    const pathMatch = url.match(pathPattern);
    if (pathMatch) {
        const coords = pathMatch[0].split('/')[1].split(',');
        gpsInfo.latitude = parseFloat(coords[0]);
        gpsInfo.longitude = parseFloat(coords[1]);
        gpsInfo.hasGPS = true;
        gpsInfo.source = 'URL路径';
        gpsInfo.format = '坐标对';
    }
    
    // 3. 从Headers中提取
    const locationHeader = headers['Location'] || headers['location'];
    if (locationHeader) {
        const locMatch = locationHeader.match(/[-0-9.]+\,[-0-9.]+/);
        if (locMatch) {
            const coords = locMatch[0].split(',');
            gpsInfo.latitude = parseFloat(coords[0]);
            gpsInfo.longitude = parseFloat(coords[1]);
            gpsInfo.hasGPS = true;
            gpsInfo.source = 'Location头';
        }
    }
    
    // 4. 从X-Apple-* 头中提取
    Object.keys(headers).forEach(key => {
        if (key.startsWith('X-Apple-')) {
            const value = headers[key];
            if (value && value.includes(',')) {
                const coordMatch = value.match(/[-0-9.]+\,[-0-9.]+/);
                if (coordMatch) {
                    const coords = coordMatch[0].split(',');
                    gpsInfo.latitude = parseFloat(coords[0]);
                    gpsInfo.longitude = parseFloat(coords[1]);
                    gpsInfo.hasGPS = true;
                    gpsInfo.source = key;
                }
            }
        }
    });
    
    return gpsInfo;
}

// 保存数据到持久化存储
function saveRequestData(requestInfo) {
    // 读取历史记录
    let history = $persistentStore.read("apple_weather_background_requests");
    if (!history) {
        history = [];
    } else {
        try {
            history = JSON.parse(history);
        } catch (e) {
            history = [];
        }
    }
    
    // 添加新记录
    history.push(requestInfo);
    
    // 只保留最近50条记录
    if (history.length > 50) {
        history = history.slice(history.length - 50);
    }
    
    // 保存记录
    $persistentStore.write(JSON.stringify(history), "apple_weather_background_requests");
}

// 主逻辑
if (typeof $request !== "undefined") {
    const request = $request;
    const isBackground = isBackgroundRequest(request);
    const gpsInfo = extractGPSInfo(request.url, request.headers);
    
    // 构建请求信息对象
    const requestInfo = {
        url: request.url,
        method: request.method,
        domain: new URL(request.url).hostname,
        timestamp: new Date().getTime(),
        isBackground: isBackground,
        gpsInfo: gpsInfo,
        headers: request.headers,
        userAgent: request.headers['User-Agent'] || ''
    };
    
    // 保存数据
    saveRequestData(requestInfo);
    
    // 输出日志
    console.log(`📍 拦截到请求: ${request.url}`);
    console.log(`🌐 域名: ${requestInfo.domain}`);
    console.log(`📱 是否后台: ${isBackground ? '✅ 是' : '❌ 否'}`);
    console.log(`📍 GPS状态: ${gpsInfo.hasGPS ? '✅ 包含定位' : '❌ 无定位'}`);
    
    if (gpsInfo.hasGPS) {
        console.log(`🛰️ 纬度: ${gpsInfo.latitude}`);
        console.log(`🛰️ 经度: ${gpsInfo.longitude}`);
        console.log(`📡 来源: ${gpsInfo.source}`);
    }
    
    // 发送通知（仅针对后台请求或带GPS的请求）
    if (isBackground || gpsInfo.hasGPS) {
        const title = gpsInfo.hasGPS ? 
            '📍 发现带定位的天气请求' : 
            (isBackground ? '🌙 后台天气请求' : '🌤️ 天气请求');
        
        const subtitle = gpsInfo.hasGPS ? 
            `坐标: ${gpsInfo.latitude}, ${gpsInfo.longitude}` :
            `域名: ${requestInfo.domain}`;
        
        const body = [
            `类型: ${isBackground ? '后台' : '前台'}`,
            `GPS: ${gpsInfo.hasGPS ? '有' : '无'}`,
            `时间: ${new Date().toLocaleTimeString()}`,
            `来源: ${gpsInfo.source || '未知'}`
        ].join('\n');
        
        $notification.post(title, subtitle, body);
    }
    
} else {
    // 显示历史统计
    try {
        const historyRaw = $persistentStore.read("apple_weather_background_requests");
        if (historyRaw) {
            const history = JSON.parse(historyRaw);
            const total = history.length;
            const backgroundCount = history.filter(r => r.isBackground).length;
            const gpsCount = history.filter(r => r.gpsInfo?.hasGPS).length;
            const backgroundGPS = history.filter(r => r.isBackground && r.gpsInfo?.hasGPS).length;
            
            console.log(`📊 统计报告:`);
            console.log(`📈 总请求数: ${total}`);
            console.log(`🌙 后台请求: ${backgroundCount}`);
            console.log(`📍 带GPS请求: ${gpsCount}`);
            console.log(`🎯 后台带GPS: ${backgroundGPS}`);
            
            // 显示最近5条后台带GPS的请求
            const recentGPS = history
                .filter(r => r.isBackground && r.gpsInfo?.hasGPS)
                .slice(-5)
                .reverse();
            
            let body = `📊 监控报告\n`;
            body += `──────────────\n`;
            body += `总计: ${total} 条请求\n`;
            body += `后台: ${backgroundCount} 条\n`;
            body += `带GPS: ${gpsCount} 条\n`;
            body += `后台+GPS: ${backgroundGPS} 条\n\n`;
            
            if (recentGPS.length > 0) {
                body += `最近的后台GPS请求:\n`;
                recentGPS.forEach((req, i) => {
                    const time = new Date(req.timestamp).toLocaleTimeString();
                    body += `${i+1}. ${time} - ${req.gpsInfo.latitude.toFixed(4)},${req.gpsInfo.longitude.toFixed(4)}\n`;
                });
            }
            
            $notification.post(
                "📊 后台天气监控报告",
                `后台GPS请求: ${backgroundGPS} 次`,
                body
            );
        } else {
            $notification.post(
                "📊 后台天气监控",
                "暂无后台请求记录",
                "请等待系统自动刷新或添加位置小组件"
            );
        }
    } catch (e) {
        console.log("❌ 读取历史记录失败:", e);
    }
}

$done();