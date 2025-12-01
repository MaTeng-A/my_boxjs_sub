// 名称: 完整GPS定位（终极版）
// 描述: 拦截天气GPS坐标并确保正常显示天气数据 - 终极优化版
// 作者: Assistant  
// 版本: 3.0 - 终极优化版

console.log("🎯 GPS拦截脚本启动（终极版）");

// 全局计数器，用于调试
let requestCount = parseInt($persistentStore.read("intercept_count") || "0");
requestCount++;
$persistentStore.write(requestCount.toString(), "intercept_count");

if (typeof $request !== "undefined") {
    console.log(`🔄 拦截到请求 #${requestCount}: ${$request.url}`);
    
    // 提取坐标 - 多种匹配模式
    const url = $request.url;
    let lat, lng;
    let matchedPattern = 0;
    
    // 终极匹配模式 - 按优先级排列
    const patterns = [
        // 模式1: /api/v1/availability/{lat}/{lng}
        {
            name: "API v1 availability",
            regex: /weatherkit\.apple\.com\/api\/v1\/availability\/([-0-9.]+)\/([-0-9.]+)/
        },
        // 模式2: /api/v2/availability/{lat}/{lng}
        {
            name: "API v2 availability",
            regex: /weatherkit\.apple\.com\/api\/v2\/availability\/([-0-9.]+)\/([-0-9.]+)/
        },
        // 模式3: /api/v1/weather/{lang}/{lat}/{lng}
        {
            name: "API v1 weather",
            regex: /weatherkit\.apple\.com\/api\/v1\/weather\/[^\/]+\/([-0-9.]+)\/([-0-9.]+)/
        },
        // 模式4: /api/v2/weather/{lang}/{lat}/{lng}
        {
            name: "API v2 weather",
            regex: /weatherkit\.apple\.com\/api\/v2\/weather\/[^\/]+\/([-0-9.]+)\/([-0-9.]+)/
        },
        // 模式5: 不带api前缀的v1/availability
        {
            name: "v1 availability (no api)",
            regex: /weatherkit\.apple\.com\/v1\/availability\/([-0-9.]+)\/([-0-9.]+)/
        },
        // 模式6: 不带api前缀的v2/availability
        {
            name: "v2 availability (no api)",
            regex: /weatherkit\.apple\.com\/v2\/availability\/([-0-9.]+)\/([-0-9.]+)/
        },
        // 模式7: 查询参数 lat/lng
        {
            name: "query lat/lng",
            regex: /[?&]lat=([-0-9.]+)[&]?.*[?&]lng=([-0-9.]+)/
        },
        // 模式8: 查询参数 latitude/longitude
        {
            name: "query latitude/longitude",
            regex: /[?&]latitude=([-0-9.]+)[&]?.*[?&]longitude=([-0-9.]+)/
        },
        // 模式9: 通用匹配 - 任何包含两个数字的模式
        {
            name: "generic coordinate pair",
            regex: /\/([-0-9.]+)\/([-0-9.]+)(?:\?|$|\/)/
        }
    ];
    
    // 尝试每个模式
    for (let i = 0; i < patterns.length; i++) {
        const pattern = patterns[i];
        const match = url.match(pattern.regex);
        if (match && match[1] && match[2]) {
            lat = match[1];
            lng = match[2];
            matchedPattern = i + 1;
            console.log(`🎯 模式${matchedPattern} (${pattern.name}): ${lat}, ${lng}`);
            break;
        }
    }
    
    if (lat && lng) {
        // 保存拦截记录
        const interceptLog = {
            count: requestCount,
            url: url,
            lat: lat,
            lng: lng,
            pattern: matchedPattern,
            time: Date.now()
        };
        
        $persistentStore.write(JSON.stringify(interceptLog), "last_intercept_log");
        
        // 读取上一次的位置数据
        const lastLocationData = $persistentStore.read("accurate_gps_location");
        const lastTimestamp = $persistentStore.read("location_timestamp");
        
        let changed = false;
        if (lastLocationData) {
            try {
                const lastLocation = JSON.parse(lastLocationData);
                const sameLocation = (lastLocation.latitude === lat && lastLocation.longitude === lng);
                
                if (!sameLocation) {
                    changed = true;
                    console.log("📍 位置已变化:");
                    console.log(`  原坐标: ${lastLocation.latitude}, ${lastLocation.longitude}`);
                    console.log(`  新坐标: ${lat}, ${lng}`);
                } else {
                    console.log("📍 位置相同");
                }
            } catch (e) {
                console.log("⚠️ 无法比较位置:", e.message);
                changed = true;
            }
        } else {
            changed = true;
        }
        
        // 保存GPS数据
        const locationData = {
            latitude: lat,
            longitude: lng,
            timestamp: Date.now(),
            source: "weatherkit_apple",
            accuracy: "high",
            url: url,
            pattern: matchedPattern,
            changed: changed,
            interceptCount: requestCount
        };
        
        $persistentStore.write(JSON.stringify(locationData), "accurate_gps_location");
        $persistentStore.write(Date.now().toString(), "location_timestamp");
        
        console.log("💾 GPS数据已保存");
        console.log(`📊 拦截总数: ${requestCount}`);
        console.log(`🔄 位置变化: ${changed ? '是' : '否'}`);
        
    } else {
        console.log("❌ 未提取到坐标");
        console.log("🔍 原始URL:", url);
        
        // 尝试更简单的提取
        const coordMatch = url.match(/([-0-9.]+)\/([-0-9.]+)/);
        if (coordMatch && coordMatch[1] && coordMatch[2]) {
            console.log("🔍 发现可能的坐标:", coordMatch[1], coordMatch[2]);
        }
    }
    
    // 直接完成请求
    $done({});
    
} else {
    // 手动检查模式
    console.log("📊 GPS状态检查（终极版）");
    
    const locationData = $persistentStore.read("accurate_gps_location");
    const timestamp = $persistentStore.read("location_timestamp");
    const interceptCount = $persistentStore.read("intercept_count");
    const lastIntercept = $persistentStore.read("last_intercept_log");
    
    console.log(`📈 拦截总数: ${interceptCount || 0}`);
    
    if (lastIntercept) {
        try {
            const log = JSON.parse(lastIntercept);
            console.log(`📝 最后拦截: #${log.count}, 模式${log.pattern}`);
            console.log(`  坐标: ${log.lat}, ${log.lng}`);
            console.log(`  时间: ${new Date(log.time).toLocaleTimeString()}`);
        } catch (e) {
            console.log("❌ 无法解析最后拦截日志");
        }
    }
    
    if (locationData && timestamp) {
        try {
            const location = JSON.parse(locationData);
            const timeDiff = Math.round((Date.now() - parseInt(timestamp)) / 60000);
            
            console.log("\n📍 当前GPS数据:");
            console.log(`  坐标: ${location.latitude}, ${location.longitude}`);
            console.log(`  来源: ${location.source || "未知"}`);
            console.log(`  模式: ${location.pattern || "未知"}`);
            console.log(`  变化: ${location.changed ? '是' : '否'}`);
            console.log(`  年龄: ${timeDiff}分钟`);
            console.log(`  时间: ${new Date(parseInt(timestamp)).toLocaleTimeString()}`);
            
            // 获取详细地址信息
            getDetailedAddress(location.latitude, location.longitude, timeDiff);
            
        } catch (e) {
            console.log("❌ 数据解析失败:", e);
            $done();
        }
    } else {
        console.log("❌ 无GPS定位数据");
        $done();
    }
}

function getDetailedAddress(lat, lng, timeDiff) {
    const TENCENT_TOKEN = "F7NBZ-MC3R3-6AV3J-RR75X-KKDTE-EKFLQ";
    const geocoderUrl = `https://apis.map.qq.com/ws/geocoder/v1/?key=${TENCENT_TOKEN}&location=${lat},${lng}`;
    
    console.log("🗺️ 获取地址信息...");
    
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
                    console.log("✅ 地址解析成功");
                } else {
                    addressText = "地址解析失败";
                }
            } catch (e) {
                addressText = "地址数据解析错误";
            }
        } else {
            addressText = "网络请求失败";
        }
        
        console.log(`📍 GPS状态:`);
        console.log(`  坐标: ${lat}, ${lng}`);
        console.log(`  时间: ${timeDiff}分钟前`);
        console.log(`  地址: ${addressText}`);
        
        $done();
    });
}