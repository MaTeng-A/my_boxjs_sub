// 名称: 苹果天气GPS拦截器 (最终版)
// 描述: 精准拦截苹果天气GPS坐标，发送精美排版通知
// 版本: 10.0 - 最终版
// 作者: MaTeng-A
// 更新时间: 2025-12-03

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
    if (!url.includes('weatherkit.apple.com')) {
        console.log("🚫 非天气应用请求，跳过处理");
        $done({});
        return;
    }
    
    console.log("🌤️ 识别为天气应用请求");
    const coords = extractWeatherCoordinates(url);
    
    if (coords && isValidCoordinate(coords.lat, coords.lng)) {
        const lat = coords.lat;
        const lng = coords.lng;
        const currentTime = Date.now();
        
        console.log(`✅ 成功提取有效坐标: ${lat}, ${lng}`);
        
        // 保存GPS数据
        saveLocationData(lat, lng, currentTime);
        
        // 立即发送通知
        console.log("📲 准备发送通知");
        getDetailedAddressAndNotify(lat, lng, "weatherkit_apple", currentTime);
        
    } else {
        console.log("❌ 未找到有效坐标");
        $done({});
    }
}

function handleManualCheck() {
    console.log("📊 GPS状态手动检查");
    
    const locationData = $persistentStore.read("gps_location_data");
    
    if (locationData) {
        try {
            const data = JSON.parse(locationData);
            const currentTime = Date.now();
            const timeDiff = Math.round((currentTime - data.timestamp) / 60000);
            
            getDetailedAddressAndNotify(data.latitude, data.longitude, "weatherkit_apple", data.timestamp, timeDiff);
            
        } catch (e) {
            console.log("❌ 数据解析失败:", e);
            sendSimpleNotification("❌ GPS状态检查失败", "数据解析错误", e.message);
        }
    } else {
        console.log("❌ 无GPS定位数据");
        sendSimpleNotification("📍 GPS定位状态", "等待定位数据", "请打开天气App触发定位");
    }
}

function extractWeatherCoordinates(url) {
    const weatherPatterns = [
        /weatherkit\.apple\.com\/v[12]\/weather\/[^\/]+\/([0-9.-]+)\/([0-9.-]+)/,
        /[?&]lat=([0-9.-]+)[^&]*[?&]lng=([0-9.-]+)/i,
        /[?&]latitude=([0-9.-]+)[^&]*[?&]longitude=([0-9.-]+)/i,
        /[?&]location=([0-9.-]+)%2C([0-9.-]+)/i,
        /[?&]coords=([0-9.-]+),([0-9.-]+)/i
    ];
    
    for (let pattern of weatherPatterns) {
        const match = url.match(pattern);
        if (match && match[1] && match[2]) {
            let lat = parseFloat(match[1]).toFixed(6);
            let lng = parseFloat(match[2]).toFixed(6);
            
            lat = simplifyCoordinate(lat);
            lng = simplifyCoordinate(lng);
            
            if (isValidCoordinate(lat, lng)) {
                console.log(`🌤️ 从天气URL提取坐标: ${lat}, ${lng}`);
                return { lat, lng };
            }
        }
    }
    
    // 通用匹配模式
    const generalPattern = /[?&](?:lat|latitude)=([0-9.-]+).*?[?&](?:lng|longitude)=([0-9.-]+)/i;
    const generalMatch = url.match(generalPattern);
    if (generalMatch && generalMatch[1] && generalMatch[2]) {
        let lat = parseFloat(generalMatch[1]).toFixed(6);
        let lng = parseFloat(generalMatch[2]).toFixed(6);
        
        lat = simplifyCoordinate(lat);
        lng = simplifyCoordinate(lng);
        
        if (isValidCoordinate(lat, lng)) {
            console.log(`🌤️ 从通用模式提取坐标: ${lat}, ${lng}`);
            return { lat, lng };
        }
    }
    
    return null;
}

function simplifyCoordinate(coord) {
    let num = parseFloat(coord);
    if (num % 1 === 0) return num.toString();
    return num.toFixed(6).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

function isValidCoordinate(lat, lng) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (isNaN(latNum) || isNaN(lngNum)) return false;
    if (latNum < -90 || latNum > 90) return false;
    if (lngNum < -180 || lngNum > 180) return false;
    return true;
}

function saveLocationData(lat, lng, timestamp) {
    const locationData = {
        latitude: lat,
        longitude: lng,
        timestamp: timestamp,
        appName: "weatherkit_apple",
        accuracy: "高精度GPS",
        source: "weatherkit"
    };
    
    $persistentStore.write(JSON.stringify(locationData), "gps_location_data");
    console.log("💾 GPS数据已保存");
    
    // 异步获取地址信息
    getAddressAsync(lat, lng);
}

function getAddressAsync(lat, lng) {
    const TENCENT_TOKEN = "F7NBZ-MC3R3-6AV3J-RR75X-KKDTE-EKFLQ";
    const geocoderUrl = `https://apis.map.qq.com/ws/geocoder/v1/?key=${TENCENT_TOKEN}&location=${lat},${lng}`;
    
    $httpClient.get(geocoderUrl, function(error, response, data) {
        if (!error && response.status === 200) {
            try {
                const result = JSON.parse(data);
                if (result.status === 0) {
                    const address = result.result.address_component;
                    const addressText = `${address.province || ''}${address.city || ''}${address.district || ''}`;
                    
                    const locationData = JSON.parse($persistentStore.read("gps_location_data") || "{}");
                    locationData.address = addressText;
                    locationData.fullAddress = result.result.formatted_addresses?.recommend || result.result.address;
                    $persistentStore.write(JSON.stringify(locationData), "gps_location_data");
                    
                    console.log("📍 地址信息已保存:", addressText);
                }
            } catch (e) {
                console.log("❌ 地址解析失败:", e);
            }
        }
    });
}

function getDetailedAddressAndNotify(lat, lng, source, timestamp, timeDiffMinutes = null) {
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
                    detailedAddress = result.result.formatted_addresses?.recommend || result.result.address || addressText;
                    
                    if (address.street) {
                        addressText += address.street;
                        if (address.street_number) addressText += address.street_number;
                    }
                    
                    console.log("✅ 地址解析成功:", addressText);
                    
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
        
        // 格式化时间（精确到分钟）
        const updateTime = new Date(timestamp).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).replace(/\//g, '-');
        
        // ======================================
        // 构建通知内容 (精美Emoji图标版)
        // ======================================
        const title = "📍 GPS定位成功";
        const subtitle = `📍 ${addressText}`; // 地址仅在副标题显示一次

        let body = ""; // 正文直接从时间信息开始
        if (timeDiffMinutes !== null && timeDiffMinutes > 0) {
        body += `⏰ 更新时间: ${timeDiffMinutes}分钟前\n`;
        } else {
        body += `⏰ 拦截时间: ${updateTime}\n`;
        }
        
        body += `📡 数据来源: ${source}\n`;
        body += `🌐 坐标精度: 高精度GPS\n`;
        body += `🌎 经纬度: ${lat}, ${lng}\n\n`;
        body += `🏠　详细地址: ${detailedAddress || addressText}`; // 确保没有\n和前置空格
        
        // ======================================
        
        // 发送通知
        $notification.post(title, subtitle, body);
        console.log("📲 已发送通知");
        
        // 结束请求
        $done({});
    });
}

function sendSimpleNotification(title, subtitle, body) {
    $notification.post(title, subtitle, body);
    $done();
}