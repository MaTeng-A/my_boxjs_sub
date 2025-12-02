// 名称: 精准GPS拦截器
// 描述: 精准拦截天气和高德地图的GPS坐标
// 版本: 6.0 - 精准拦截版
// 作者: Assistant
// 更新时间: 2025-12-02

console.log("🎯 精准GPS拦截器启动 - 仅拦截天气和高德地图");

const isRequest = typeof $request !== 'undefined';
console.log(`📱 运行模式: ${isRequest ? '拦截请求' : '手动检查'}`);

if (isRequest) {
    handleRequest($request);
} else {
    handleManualCheck();
}

function handleRequest(request) {
    const url = request.url;
    const headers = request.headers || {};
    
    console.log("📡 拦截到请求:", url.substring(0, 100) + (url.length > 100 ? "..." : ""));
    
    // 只处理天气和高德地图的请求
    const isWeatherRequest = url.includes('weatherkit.apple.com');
    const isAmapRequest = url.includes('amap.com') || url.includes('gaode.com');
    
    if (!isWeatherRequest && !isAmapRequest) {
        console.log("🚫 非目标应用请求，跳过处理");
        $done({});
        return;
    }
    
    let lat, lng, appName;
    
    if (isWeatherRequest) {
        console.log("🌤️ 识别为天气应用请求");
        const coords = extractWeatherCoordinates(url);
        if (coords) {
            lat = coords.lat;
            lng = coords.lng;
            appName = "苹果天气";
        }
    } else if (isAmapRequest) {
        console.log("🗺️ 识别为高德地图请求");
        const coords = extractAmapCoordinates(url, headers);
        if (coords) {
            lat = coords.lat;
            lng = coords.lng;
            appName = "高德地图";
        }
    }
    
    // 验证坐标有效性
    if (lat && lng && isValidCoordinate(lat, lng)) {
        console.log(`✅ 成功提取有效坐标: ${lat}, ${lng} (来源: ${appName})`);
        
        // 保存GPS数据
        saveLocationData(lat, lng, appName, url);
        
        // 发送通知
        sendImmediateNotification(lat, lng, appName);
        
    } else {
        console.log("❌ 未找到有效坐标或坐标无效");
        
        // 记录错误信息以便调试
        if (lat && lng) {
            console.log(`⚠️ 无效坐标: ${lat}, ${lng} (可能匹配到其他参数)`);
        }
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
            const timeDiff = Math.round((Date.now() - data.timestamp) / 60000);
            
            // 获取地址并发送详细通知
            getDetailedAddressAndNotify(data.latitude, data.longitude, data.appName, data.timestamp, timeDiff);
            
        } catch (e) {
            console.log("❌ 数据解析失败:", e);
            sendSimpleNotification("❌ GPS状态检查失败", "数据解析错误", e.message);
            $done();
        }
    } else {
        console.log("❌ 无GPS定位数据");
        sendSimpleNotification("📍 GPS定位状态", "等待定位数据", "请打开天气App或高德地图触发定位");
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
            const lat = parseFloat(match[1]).toFixed(6);
            const lng = parseFloat(match[2]).toFixed(6);
            
            // 验证坐标范围
            if (isValidCoordinate(lat, lng)) {
                console.log(`🌤️ 从天气URL提取坐标: ${lat}, ${lng}`);
                return { lat, lng };
            }
        }
    }
    
    return null;
}

// 提取高德地图坐标
function extractAmapCoordinates(url, headers) {
    // 高德地图API常见的坐标参数
    const amapPatterns = [
        // location参数格式: 经度,纬度 或 纬度,经度
        /[?&]location=([0-9.-]+)[,%2C]([0-9.-]+)/,
        // lat和lon参数
        /[?&]lat=([0-9.-]+)[^&]*[?&]lon=([0-9.-]+)/i,
        // x和y参数（有时x是经度，y是纬度）
        /[?&]x=([0-9.-]+)[^&]*[?&]y=([0-9.-]+)/i,
        // 直接坐标对
        /[?&]coords=([0-9.-]+)[,%2C]([0-9.-]+)/i
    ];
    
    for (let pattern of amapPatterns) {
        const match = url.match(pattern);
        if (match && match[1] && match[2]) {
            let lat, lng;
            
            // 高德地图通常使用GCJ-02坐标系
            // location参数通常是 经度,纬度
            if (pattern.toString().includes('location')) {
                // location=116.397428,39.90923 格式：经度,纬度
                lng = parseFloat(match[1]).toFixed(6);
                lat = parseFloat(match[2]).toFixed(6);
            } else {
                // 其他情况假设第一个是纬度，第二个是经度
                lat = parseFloat(match[1]).toFixed(6);
                lng = parseFloat(match[2]).toFixed(6);
            }
            
            if (isValidCoordinate(lat, lng)) {
                console.log(`🗺️ 从高德地图URL提取坐标: ${lat}, ${lng}`);
                return { lat, lng };
            }
        }
    }
    
    // 尝试从POST数据中提取（如果有body的话）
    if (headers['Content-Type'] && headers['Content-Type'].includes('application/json')) {
        console.log("📦 检测到JSON格式请求，需要处理请求体");
        // 注意：在Loon中，请求体可能需要特殊处理
    }
    
    return null;
}

// 验证坐标有效性
function isValidCoordinate(lat, lng) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    
    // 有效纬度范围：-90 到 90
    // 有效经度范围：-180 到 180
    // 排除明显无效的值（如843, 411）
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
    
    // 中国境内的坐标范围（大致）
    if (latNum > 3 && latNum < 54 && lngNum > 73 && lngNum < 136) {
        return true;
    }
    
    // 如果不是中国境内坐标，也允许但记录日志
    console.log(`🌍 检测到中国境外坐标: ${lat}, ${lng}`);
    return true;
}

// 保存位置数据
function saveLocationData(lat, lng, appName, url) {
    const locationData = {
        latitude: lat,
        longitude: lng,
        timestamp: Date.now(),
        appName: appName,
        url: url,
        accuracy: "高精度GPS",
        source: appName === "苹果天气" ? "weatherkit" : "amap"
    };
    
    $persistentStore.write(JSON.stringify(locationData), "gps_location_data");
    $persistentStore.write(Date.now().toString(), "gps_timestamp");
    
    console.log("💾 GPS数据已保存");
    
    // 同时获取地址信息（异步）
    getAddressAsync(lat, lng);
}

// 异步获取地址信息
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
                    
                    // 更新保存的位置数据
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

// 发送即时通知（拦截时）
function sendImmediateNotification(lat, lng, appName) {
    const timestamp = Date.now();
    const updateTime = new Date(timestamp).toLocaleTimeString('zh-CN', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    // 读取已保存的地址信息
    const locationData = JSON.parse($persistentStore.read("gps_location_data") || "{}");
    const addressText = locationData.address || "地址获取中...";
    
    const title = "📍 GPS定位成功";
    const subtitle = addressText;
    const body = `数据来源: ${appName}\n坐标精度: 高精度GPS\n经纬度: ${lat}, ${lng}\n更新时间: ${updateTime}`;
    
    $notification.post(title, subtitle, body);
    console.log("📲 已发送即时通知");
}

// 获取详细地址并发送通知（手动检查时）
function getDetailedAddressAndNotify(lat, lng, appName, timestamp, timeDiffMinutes) {
    const TENCENT_TOKEN = "F7NBZ-MC3R3-6AV3J-RR75X-KKDTE-EKFLQ";
    const geocoderUrl = `https://apis.map.qq.com/ws/geocoder/v1/?key=${TENCENT_TOKEN}&location=${lat},${lng}`;
    
    console.log("🗺️ 获取详细地址信息...");
    
    $httpClient.get(geocoderUrl, function(error, response, data) {
        let addressText = "地址解析失败";
        
        if (!error && response.status === 200) {
            try {
                const result = JSON.parse(data);
                if (result.status === 0) {
                    const address = result.result.address_component;
                    addressText = `${address.province || ''}${address.city || ''}${address.district || ''}`;
                    
                    if (address.street) {
                        addressText += address.street;
                        if (address.street_number) {
                            addressText += address.street_number;
                        }
                    }
                    
                    console.log("✅ 地址解析成功:", addressText);
                } else {
                    console.log("❌ 腾讯地图API错误:", result.message);
                }
            } catch (e) {
                console.log("❌ 地址数据解析错误:", e);
            }
        } else {
            console.log("❌ 网络请求失败:", error || response.status);
        }
        
        const updateTime = new Date(timestamp).toLocaleString('zh-CN');
        const title = "📍 GPS定位状态";
        const subtitle = addressText;
        const body = `数据来源: ${appName}\n更新时间: ${timeDiffMinutes}分钟前 (${updateTime})\n经纬度: ${lat}, ${lng}\n坐标精度: 高精度GPS`;
        
        $notification.post(title, subtitle, body);
        console.log("📲 已发送详细通知");
        
        $done();
    });
}

// 发送简单通知
function sendSimpleNotification(title, subtitle, body) {
    $notification.post(title, subtitle, body);
    $done();
}