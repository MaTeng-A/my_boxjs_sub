// 名称: 苹果天气GPS拦截器
// 描述: 精准拦截苹果天气的GPS坐标
// 版本: 7.0 - 天气专用版
// 作者: Assistant
// 更新时间: 2025-12-02

console.log("🎯 苹果天气GPS拦截器启动");

const isRequest = typeof $request !== 'undefined';
console.log(`📱 运行模式: ${isRequest ? '拦截请求' : '手动检查'}`);

if (isRequest) {
    handleRequest($request);
} else {
    handleManualCheck();
}

function handleRequest(request) {
    const url = request.url;
    
    console.log("📡 拦截到请求:", url.substring(0, 100) + (url.length > 100 ? "..." : ""));
    
    // 只处理天气应用的请求
    const isWeatherRequest = url.includes('weatherkit.apple.com');
    
    if (!isWeatherRequest) {
        console.log("🚫 非天气应用请求，跳过处理");
        $done({});
        return;
    }
    
    console.log("🌤️ 识别为天气应用请求");
    const coords = extractWeatherCoordinates(url);
    
    if (coords && isValidCoordinate(coords.lat, coords.lng)) {
        const lat = coords.lat;
        const lng = coords.lng;
        console.log(`✅ 成功提取有效坐标: ${lat}, ${lng}`);
        
        // 保存GPS数据
        saveLocationData(lat, lng);
        
        // 检查是否需要发送通知
        checkAndSendNotification(lat, lng, "weatherkit_apple");
        
    } else {
        console.log("❌ 未找到有效坐标");
    }
    
    $done({});
}

function handleManualCheck() {
    console.log("📊 GPS状态手动检查");
    
    const locationData = $persistentStore.read("gps_location_data");
    const timestamp = $persistentStore.read("gps_timestamp");
    
    if (locationData && timestamp) {
        try {
            const data = JSON.parse(locationData);
            const currentTime = Date.now();
            const timeDiff = Math.round((currentTime - data.timestamp) / 60000);
            
            // 手动检查时总是发送通知
            getDetailedAddressAndNotify(data.latitude, data.longitude, "weatherkit_apple", data.timestamp, timeDiff);
            
        } catch (e) {
            console.log("❌ 数据解析失败:", e);
            sendSimpleNotification("❌ GPS状态检查失败", "数据解析错误", e.message);
            $done();
        }
    } else {
        console.log("❌ 无GPS定位数据");
        sendSimpleNotification("📍 GPS定位状态", "等待定位数据", "请打开天气App触发定位");
        $done();
    }
}

// 提取天气应用坐标
function extractWeatherCoordinates(url) {
    // 天气应用坐标提取模式
    const weatherPatterns = [
        /weatherkit\.apple\.com\/v[12]\/weather\/[^\/]+\/([0-9.-]+)\/([0-9.-]+)/,
        /[?&]lat=([0-9.-]+)[^&]*[?&]lng=([0-9.-]+)/i
    ];
    
    for (let pattern of weatherPatterns) {
        const match = url.match(pattern);
        if (match && match[1] && match[2]) {
            let lat = parseFloat(match[1]).toFixed(6);
            let lng = parseFloat(match[2]).toFixed(6);
            
            // 简化显示：去掉末尾的0
            lat = simplifyCoordinate(lat);
            lng = simplifyCoordinate(lng);
            
            // 验证坐标范围
            if (isValidCoordinate(lat, lng)) {
                console.log(`🌤️ 从天气URL提取坐标: ${lat}, ${lng}`);
                return { lat, lng };
            }
        }
    }
    
    return null;
}

// 简化坐标显示
function simplifyCoordinate(coord) {
    let num = parseFloat(coord);
    // 如果是整数或小数部分全是0，直接返回整数形式
    if (num % 1 === 0) {
        return num.toString();
    }
    // 去掉末尾的0
    return num.toString().replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

// 验证坐标有效性
function isValidCoordinate(lat, lng) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    
    if (isNaN(latNum) || isNaN(lngNum)) {
        return false;
    }
    
    if (latNum < -90 || latNum > 90) {
        console.log(`❌ 纬度 ${lat} 超出有效范围(-90~90)`);
        return false;
    }
    
    if (lngNum < -180 || lngNum > 180) {
        console.log(`❌ 经度 ${lng} 超出有效范围(-180~180)`);
        return false;
    }
    
    return true;
}

// 保存位置数据
function saveLocationData(lat, lng) {
    const locationData = {
        latitude: lat,
        longitude: lng,
        timestamp: Date.now(),
        appName: "weatherkit_apple",
        accuracy: "高精度GPS",
        source: "weatherkit"
    };
    
    $persistentStore.write(JSON.stringify(locationData), "gps_location_data");
    $persistentStore.write(Date.now().toString(), "gps_timestamp");
    
    console.log("💾 GPS数据已保存");
}

// 检查是否需要发送通知
function checkAndSendNotification(lat, lng, source) {
    const lastNotificationTime = $persistentStore.read("last_notification_time");
    const currentTime = Date.now();
    
    let shouldSend = false;
    
    if (!lastNotificationTime) {
        // 首次拦截，发送通知
        shouldSend = true;
    } else {
        const timeDiff = (currentTime - parseInt(lastNotificationTime)) / 60000; // 分钟
        
        if (timeDiff > 30) {
            // 距离上次通知超过30分钟，发送通知
            shouldSend = true;
        } else {
            console.log(`⏰ 距离上次通知仅 ${Math.round(timeDiff)} 分钟，跳过通知`);
        }
    }
    
    if (shouldSend) {
        // 更新上次通知时间
        $persistentStore.write(currentTime.toString(), "last_notification_time");
        // 获取详细地址并发送通知
        getDetailedAddressAndNotify(lat, lng, source, currentTime, 0);
    }
}

// 获取详细地址并发送通知
function getDetailedAddressAndNotify(lat, lng, source, timestamp, timeDiffMinutes) {
    const TENCENT_TOKEN = "F7NBZ-MC3R3-6AV3J-RR75X-KKDTE-EKFLQ";
    const geocoderUrl = `https://apis.map.qq.com/ws/geocoder/v1/?key=${TENCENT_TOKEN}&location=${lat},${lng}`;
    
    console.log("🗺️ 获取详细地址信息...");
    
    $httpClient.get(geocoderUrl, function(error, response, data) {
        let addressText = "地址解析中...";
        let detailedAddress = "";
        
        if (!error && response.status === 200) {
            try {
                const result = JSON.parse(data);
                if (result.status === 0) {
                    const address = result.result.address_component;
                    addressText = `${address.province || ''}${address.city || ''}${address.district || ''}`;
                    
                    // 详细地址
                    detailedAddress = result.result.formatted_addresses?.recommend || result.result.address || addressText;
                    
                    // 如果有街道信息，添加到地址文本
                    if (address.street) {
                        addressText += address.street;
                        if (address.street_number) {
                            addressText += address.street_number;
                        }
                    }
                    
                    console.log("✅ 地址解析成功:", addressText);
                    
                    // 更新保存的地址信息
                    const locationData = JSON.parse($persistentStore.read("gps_location_data") || "{}");
                    locationData.address = addressText;
                    locationData.detailedAddress = detailedAddress;
                    $persistentStore.write(JSON.stringify(locationData), "gps_location_data");
                    
                } else {
                    console.log("❌ 腾讯地图API错误:", result.message);
                    addressText = "地址解析失败";
                }
            } catch (e) {
                console.log("❌ 地址数据解析错误:", e);
                addressText = "地址解析异常";
            }
        } else {
            console.log("❌ 网络请求失败:", error || response.status);
            addressText = "网络请求失败";
        }
        
        // 格式化时间
        const updateTime = new Date(timestamp).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).replace(/\//g, '-');
        
        // 构建通知内容
        let title = "📍 GPS定位成功";
        let subtitle = addressText;
        let body = "";
        
        if (timeDiffMinutes > 0) {
            title = "📍 GPS定位状态";
            body += `数据来源: ${source}\n`;
        } else {
            body += `拦截时间: ${updateTime}\n`;
            body += `数据来源: ${source}\n`;
        }
        
        body += `坐标精度: 高精度GPS\n`;
        body += `经纬度: ${lat}, ${lng}\n\n`;
        body += `详细地址:\n${detailedAddress || addressText}`;
        
        // 发送详细通知
        $notification.post(title, subtitle, body);
        console.log("📲 已发送通知");
        
        if (timeDiffMinutes > 0) {
            $done();
        }
    });
}

// 发送简单通知
function sendSimpleNotification(title, subtitle, body) {
    $notification.post(title, subtitle, body);
    $done();
}