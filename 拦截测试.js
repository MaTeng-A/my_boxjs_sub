// 名称: Loon增强版GPS拦截
// 描述: 强化GPS坐标拦截，增加多种匹配模式和调试功能
// 作者: Assistant  
// 版本: 3.0 - 增强拦截版

console.log("🎯 Loon GPS拦截脚本启动");

// 调试模式开关
const DEBUG_MODE = true;

if (typeof $request !== "undefined") {
    logDebug("✅ 拦截到请求:", $request.url);
    
    const url = $request.url;
    let lat, lng, source;
    
    // 增强的URL模式匹配
    const patterns = [
        // Apple WeatherKit 模式
        { 
            pattern: /weatherkit\.apple\.com\/(?:v1|v2)\/weather\/[^\/]+\/([0-9.-]+)\/([0-9.-]+)/,
            source: "weatherkit_apple"
        },
        // 带参数的坐标模式
        {
            pattern: /[?&]lat=([0-9.-]+)[&]?.*[?&]lng=([0-9.-]+)/,
            source: "url_params"
        },
        {
            pattern: /[?&]latitude=([0-9.-]+)[&]?.*[?&]longitude=([0-9.-]+)/, 
            source: "url_params"
        },
        // 新的Apple天气API模式
        {
            pattern: /apple\.com\/api\/v\d\/weather\/[^\/]+\/([0-9.-]+)\/([0-9.-]+)/,
            source: "apple_api"
        },
        // 通用坐标模式
        {
            pattern: /\/([0-9.-]+)\/([0-9.-]+)(?:\?|$)/,
            source: "path_coords"
        }
    ];
    
    // 尝试所有模式匹配
    for (let {pattern, source} of patterns) {
        const match = url.match(pattern);
        if (match && match[1] && match[2]) {
            lat = parseFloat(match[1]).toFixed(6);
            lng = parseFloat(match[2]).toFixed(6);
            source = source;
            logDebug(`🎯 使用模式匹配到坐标: ${lat}, ${lng} (来源: ${source})`);
            break;
        }
    }
    
    if (lat && lng) {
        processNewLocation(lat, lng, source, url);
    } else {
        logDebug("❌ 未找到坐标信息，URL模式:", url);
        // 记录未匹配的URL用于调试
        const unmatchedUrls = JSON.parse($persistentStore.read("unmatched_urls") || "[]");
        unmatchedUrls.push({
            url: url,
            timestamp: Date.now(),
            reason: "no_coord_match"
        });
        // 只保留最近10条
        if (unmatchedUrls.length > 10) unmatchedUrls.shift();
        $persistentStore.write(JSON.stringify(unmatchedUrls), "unmatched_urls");
    }
    
    $done({});
    
} else {
    // 手动检查模式
    checkGPSStatus();
}

function processNewLocation(lat, lng, source, url) {
    logDebug(`📍 提取到新坐标: ${lat}, ${lng}`);
    
    // 检查坐标是否有效
    if (!isValidCoordinate(lat, lng)) {
        logDebug("❌ 无效的坐标格式");
        return;
    }
    
    const newLocation = {
        latitude: lat,
        longitude: lng, 
        timestamp: Date.now(),
        source: source,
        accuracy: "high",
        url: url
    };
    
    // 读取旧数据进行比较
    const lastLocationData = $persistentStore.read("accurate_gps_location");
    let isNewLocation = true;
    
    if (lastLocationData) {
        try {
            const lastLocation = JSON.parse(lastLocationData);
            const coordDiff = calculateDistance(
                parseFloat(lastLocation.latitude), 
                parseFloat(lastLocation.longitude),
                parseFloat(lat),
                parseFloat(lng)
            );
            
            // 如果距离小于50米，认为是相同位置
            if (coordDiff < 0.05) {
                isNewLocation = false;
                logDebug(`📍 位置变化微小: ${coordDiff.toFixed(3)} km`);
            } else {
                logDebug(`📍 检测到新位置: 距离 ${coordDiff.toFixed(3)} km`);
            }
            
        } catch (e) {
            logDebug("❌ 解析历史位置数据失败:", e);
        }
    }
    
    // 保存新数据
    $persistentStore.write(JSON.stringify(newLocation), "accurate_gps_location");
    $persistentStore.write(Date.now().toString(), "location_timestamp");
    
    logDebug("💾 GPS数据已保存");
    
    // 如果是新位置，获取详细地址
    if (isNewLocation) {
        getDetailedAddress(lat, lng, true);
        
        // 发送成功通知
        $notification.post(
            "📍 GPS定位更新", 
            `新坐标: ${lat}, ${lng}`,
            `时间: ${new Date().toLocaleTimeString()}\n天气数据正常显示中...`
        );
    }
}

function checkGPSStatus() {
    logDebug("📊 GPS状态检查");
    
    const locationData = $persistentStore.read("accurate_gps_location");
    const timestamp = $persistentStore.read("location_timestamp");
    
    if (locationData && timestamp) {
        try {
            const location = JSON.parse(locationData);
            const timeDiff = Math.round((Date.now() - parseInt(timestamp)) / 60000);
            
            logDebug(`🌍 当前GPS数据: ${location.latitude}, ${location.longitude}`);
            logDebug(`⏰ 更新时间: ${timeDiff}分钟前`);
            
            // 如果数据超过10分钟，建议刷新
            if (timeDiff > 10) {
                logDebug("🔄 数据较旧，建议刷新");
                $notification.post(
                    "📍 GPS数据较旧",
                    `更新时间: ${timeDiff}分钟前`, 
                    "建议运行自动触发脚本刷新位置"
                );
            }
            
            getDetailedAddress(location.latitude, location.longitude, false);
            
        } catch (e) {
            logDebug("❌ 数据解析失败:", e);
            $notification.post("❌ GPS状态检查失败", "数据解析错误", e.message);
            $done();
        }
    } else {
        logDebug("❌ 无GPS定位数据");
        $notification.post(
            "📍 GPS定位状态", 
            "等待定位数据",
            "请打开系统天气App触发GPS定位"
        );
        $done();
    }
}

function getDetailedAddress(lat, lng, isNew) {
    const TENCENT_TOKEN = "F7NBZ-MC3R3-6AV3J-RR75X-KKDTE-EKFLQ";
    const geocoderUrl = `https://apis.map.qq.com/ws/geocoder/v1/?key=${TENCENT_TOKEN}&location=${lat},${lng}`;
    
    logDebug("🗺️ 获取详细地址信息...");
    
    $httpClient.get(geocoderUrl, function(error, response, data) {
        let addressText = "地址解析中...";
        
        if (!error && response.status === 200) {
            try {
                const result = JSON.parse(data);
                if (result.status === 0) {
                    const address = result.result.address_component;
                    addressText = `${address.province}${address.city}${address.district}`;
                    if (address.street) addressText += `${address.street}`;
                    if (address.street_number) addressText += `${address.street_number}`;
                    logDebug("✅ 地址解析成功:", addressText);
                    
                    // 保存地址信息
                    const locationData = JSON.parse($persistentStore.read("accurate_gps_location"));
                    locationData.address = addressText;
                    $persistentStore.write(JSON.stringify(locationData), "accurate_gps_location");
                    
                } else {
                    addressText = "地址解析失败";
                }
            } catch (e) {
                addressText = "地址数据解析错误";
            }
        } else {
            addressText = "网络请求失败";
        }
        
        if (isNew) {
            logDebug(`📍 新位置地址: ${addressText}`);
        } else {
            logDebug(`📍 当前位置地址: ${addressText}`);
        }
        
        $done();
    });
}

// 工具函数
function isValidCoordinate(lat, lng) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    return !isNaN(latNum) && !isNaN(lngNum) && 
           Math.abs(latNum) <= 90 && Math.abs(lngNum) <= 180;
}

function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // 地球半径(km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function logDebug(message, data) {
    if (DEBUG_MODE) {
        if (data) {
            console.log(`🔍 ${message}`, data);
        } else {
            console.log(`🔍 ${message}`);
        }
    }
}