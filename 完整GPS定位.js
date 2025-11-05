// 名称: 最终版GPS拦截
// 描述: 拦截天气GPS坐标并确保正常显示天气数据
// 作者: Assistant
// 版本: 2.2 - 无通知版

console.log("🎯 GPS拦截脚本启动");

if (typeof $request !== "undefined") {
    console.log("✅ 拦截到天气请求:", $request.url);
    
    // 提取坐标 - 多种匹配模式
    const url = $request.url;
    let lat, lng;
    
    // 多种URL模式匹配
    const patterns = [
        /weatherkit\.apple\.com\/v1\/weather\/[^\/]+\/([0-9.-]+)\/([0-9.-]+)/,
        /weatherkit\.apple\.com\/v2\/weather\/[^\/]+\/([0-9.-]+)\/([0-9.-]+)/,
        /[?&]lat=([0-9.-]+)[&]?.*[?&]lng=([0-9.-]+)/,
        /[?&]latitude=([0-9.-]+)[&]?.*[?&]longitude=([0-9.-]+)/
    ];
    
    for (let pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1] && match[2]) {
            lat = match[1];
            lng = match[2];
            console.log(`🎯 使用模式匹配到坐标: ${lat}, ${lng}`);
            break;
        }
    }
    
    if (lat && lng) {
        console.log(`📍 成功提取坐标: ${lat}, ${lng}`);
        
        // 检查是否是新位置或长时间未更新
        const lastLocationData = $persistentStore.read("accurate_gps_location");
        let shouldNotify = false; // 改为false，不发送通知
        
        if (lastLocationData) {
            try {
                const lastLocation = JSON.parse(lastLocationData);
                const sameLocation = (lastLocation.latitude === lat && lastLocation.longitude === lng);
                const lastTime = parseInt($persistentStore.read("location_timestamp") || "0");
                const timeDiff = Date.now() - lastTime;
                
                // 如果是相同位置且在10分钟内更新过，则不通知
                if (sameLocation && timeDiff < 10 * 60 * 1000) {
                    shouldNotify = false;
                    console.log("📍 相同位置，跳过通知");
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
        
        // 注释掉通知部分，不显示任何通知
        /*
        if (shouldNotify) {
            $notification.post(
                "📍 GPS定位成功", 
                `纬度: ${lat}, 经度: ${lng}`,
                `时间: ${new Date().toLocaleTimeString()}\n天气数据正常显示中...`
            );
        }
        */
        
    } else {
        console.log("❌ 未找到坐标信息");
    }
    
    // 关键：直接完成请求，确保天气App正常显示数据
    $done({});
    
} else {
    // 手动检查模式
    console.log("📊 GPS状态检查");
    
    const locationData = $persistentStore.read("accurate_gps_location");
    const timestamp = $persistentStore.read("location_timestamp");
    
    if (locationData && timestamp) {
        try {
            const location = JSON.parse(locationData);
            const timeDiff = Math.round((Date.now() - parseInt(timestamp)) / 60000);
            
            console.log(`🌍 当前GPS数据: ${location.latitude}, ${location.longitude}`);
            
            // 获取详细地址信息
            getDetailedAddress(location.latitude, location.longitude, timeDiff);
            
        } catch (e) {
            console.log("❌ 数据解析失败:", e);
            // 注释掉通知
            // $notification.post("❌ GPS状态检查失败", "数据解析错误", e.message);
            $done();
        }
    } else {
        console.log("❌ 无GPS定位数据");
        // 注释掉通知
        // $notification.post(
        //     "📍 GPS定位状态", 
        //     "等待定位数据",
        //     "请打开系统天气App触发GPS定位"
        // );
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
        
        // 注释掉通知，只保留控制台日志
        console.log(`📍 GPS定位状态 - 坐标: ${lat}, ${lng}`);
        console.log(`⏰ 更新时间: ${timeDiff}分钟前`);
        console.log(`🏠 详细地址: ${addressText}`);
        
        /*
        const body = `⏰ 更新时间: ${timeDiff}分钟前\n` +
                    `🌎 经纬度: ${lat}, ${lng}\n\n` +
                    `🏠 详细地址:\n${addressText}`;
        
        $notification.post("📍 GPS定位状态", `坐标: ${lat}, ${lng}`, body);
        */
        $done();
    });
}
