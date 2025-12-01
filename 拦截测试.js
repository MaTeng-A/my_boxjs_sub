// 名称: 完整GPS定位（修复版）
// 描述: 拦截天气GPS坐标并确保正常显示天气数据 - 修复availability模式
// 作者: Assistant
// 版本: 2.3 - 修复availability模式

console.log("🎯 GPS拦截脚本启动（修复版）");

if (typeof $request !== "undefined") {
    console.log("✅ 拦截到天气请求:", $request.url);
    
    // 提取坐标 - 多种匹配模式
    const url = $request.url;
    let lat, lng;
    
    // 多种URL模式匹配 - 添加availability模式
    const patterns = [
        /weatherkit\.apple\.com\/v1\/weather\/[^\/]+\/([0-9.-]+)\/([0-9.-]+)/,
        /weatherkit\.apple\.com\/v2\/weather\/[^\/]+\/([0-9.-]+)\/([0-9.-]+)/,
        /weatherkit\.apple\.com\/v1\/availability\/([0-9.-]+)\/([0-9.-]+)/,    // 新增
        /weatherkit\.apple\.com\/v2\/availability\/([0-9.-]+)\/([0-9.-]+)/,    // 新增
        /[?&]lat=([0-9.-]+)[&]?.*[?&]lng=([0-9.-]+)/,
        /[?&]latitude=([0-9.-]+)[&]?.*[?&]longitude=([0-9.-]+)/
    ];
    
    for (let pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1] && match[2]) {
            lat = match[1];
            lng = match[2];
            console.log(`🎯 使用模式匹配到坐标: ${lat}, ${lng}`);
            console.log(`📝 匹配模式: ${pattern.toString().substring(0, 60)}...`);
            break;
        }
    }
    
    if (lat && lng) {
        console.log(`📍 成功提取坐标: ${lat}, ${lng}`);
        
        // 检查是否是新位置或长时间未更新
        const lastLocationData = $persistentStore.read("accurate_gps_location");
        
        if (lastLocationData) {
            try {
                const lastLocation = JSON.parse(lastLocationData);
                const sameLocation = (lastLocation.latitude === lat && lastLocation.longitude === lng);
                const lastTime = parseInt($persistentStore.read("location_timestamp") || "0");
                const timeDiff = Date.now() - lastTime;
                
                if (sameLocation) {
                    console.log("📍 位置相同");
                    console.log(`⏰ 上次更新: ${Math.round(timeDiff/1000)}秒前`);
                } else {
                    console.log("📍 位置不同，已更新");
                    console.log(`  原坐标: ${lastLocation.latitude}, ${lastLocation.longitude}`);
                    console.log(`  新坐标: ${lat}, ${lng}`);
                }
            } catch (e) {
                console.log("❌ 解析历史位置数据失败:", e);
            }
        }
        
        // 保存GPS数据
        const locationData = {
            latitude: lat,
            longitude: lng,
            timestamp: Date.now(),
            source: "weatherkit_apple",
            accuracy: "high",
            url: url
        };
        
        $persistentStore.write(JSON.stringify(locationData), "accurate_gps_location");
        $persistentStore.write(Date.now().toString(), "location_timestamp");
        
        console.log("💾 GPS数据已保存");
        console.log(`🕒 保存时间: ${new Date().toLocaleTimeString()}`);
        
    } else {
        console.log("❌ 未找到坐标信息");
        console.log("🔍 尝试分析URL结构:");
        console.log(`  完整URL: ${url}`);
        
        // 尝试手动解析其他格式
        if (url.includes("availability")) {
            console.log("🔍 这是一个availability请求，但未匹配到坐标");
            // 尝试从路径中手动提取
            const parts = url.split('/');
            for (let i = 0; i < parts.length; i++) {
                if (parts[i] === "availability" && i + 2 < parts.length) {
                    const possibleLat = parts[i+1];
                    const possibleLng = parts[i+2];
                    if (/^[0-9.-]+$/.test(possibleLat) && /^[0-9.-]+$/.test(possibleLng)) {
                        console.log(`🔍 从路径中找到可能坐标: ${possibleLat}, ${possibleLng}`);
                    }
                }
            }
        }
    }
    
    // 关键：直接完成请求，确保天气App正常显示数据
    $done({});
    
} else {
    // 手动检查模式
    console.log("📊 GPS状态检查（修复版）");
    
    const locationData = $persistentStore.read("accurate_gps_location");
    const timestamp = $persistentStore.read("location_timestamp");
    
    if (locationData && timestamp) {
        try {
            const location = JSON.parse(locationData);
            const timeDiff = Math.round((Date.now() - parseInt(timestamp)) / 60000);
            
            console.log(`🌍 当前GPS数据: ${location.latitude}, ${location.longitude}`);
            console.log(`📡 来源: ${location.source || "未知"}`);
            console.log(`⏰ 更新时间: ${timeDiff}分钟前`);
            console.log(`🕒 具体时间: ${new Date(parseInt(timestamp)).toLocaleTimeString()}`);
            
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

// 获取详细地址信息
function getDetailedAddress(lat, lng, timeDiff) {
    const TENCENT_TOKEN = "F7NBZ-MC3R3-6AV3J-RR75X-KKDTE-EKFLQ";
    const geocoderUrl = `https://apis.map.qq.com/ws/geocoder/v1/?key=${TENCENT_TOKEN}&location=${lat},${lng}`;
    
    console.log("🗺️ 获取详细地址信息...");
    
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
                    console.log("✅ 地址解析成功:", addressText);
                } else {
                    addressText = "地址解析失败";
                }
            } catch (e) {
                addressText = "地址数据解析错误";
            }
        } else {
            addressText = "网络请求失败";
        }
        
        console.log(`📍 GPS定位状态 - 坐标: ${lat}, ${lng}`);
        console.log(`⏰ 更新时间: ${timeDiff}分钟前`);
        console.log(`🏠 详细地址: ${addressText}`);
        
        $done();
    });
}