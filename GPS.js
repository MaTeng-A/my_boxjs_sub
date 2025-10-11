// 名称: Loon请求转发版GPS定位
// 描述: 提取GPS坐标并转发请求，确保天气App正常显示
// 作者: Assistant
// 工具: Loon
// 更新时间: 2025-10-10

console.log("🎯 Loon请求转发版GPS定位启动");

if (typeof $request !== "undefined") {
    console.log("📍 拦截到WeatherKit请求");
    console.log("📡 完整URL:", $request.url);
    
    try {
        const url = $request.url;
        
        if (url.includes("weatherkit.apple.com")) {
            // 提取GPS坐标
            const pattern = /weatherkit\.apple\.com\/v2\/weather\/[^\/]+\/([0-9.-]+)\/([0-9.-]+)/;
            const res = url.match(pattern);
            
            if (res && res[1] && res[2]) {
                const lat = res[1];
                const lng = res[2];
                
                console.log(`🎯 成功提取坐标: ${lat}, ${lng}`);
                
                // 保存GPS数据
                const locationData = {
                    latitude: parseFloat(lat),
                    longitude: parseFloat(lng),
                    source: "weatherkit_apple_forward",
                    timestamp: new Date().getTime(),
                    accuracy: "high"
                };
                
                $persistentStore.write(JSON.stringify(locationData), "accurate_gps_location");
                $persistentStore.write(Date.now().toString(), "location_timestamp");
                
                console.log("✅ GPS数据已保存");
                
                // 发送成功通知（可选，可以注释掉）
                $notification.post(
                    "📍 GPS定位更新", 
                    `坐标: ${lat}, ${lng}`,
                    "数据已保存，请求已转发"
                );
            }
            
            // 关键：转发原始请求，确保天气App能正常获取数据
            // 使用Loon的$httpClient发送请求，然后返回响应
            $httpClient.get({
                url: url,
                headers: $request.headers
            }, function(error, response, data) {
                if (error) {
                    console.log("❌ 请求转发失败:", error);
                    // 即使失败也要完成请求，避免阻塞
                    $done();
                } else {
                    console.log("✅ 请求转发成功，状态码:", response.status);
                    // 将原始响应返回给天气App
                    $done({
                        status: response.status,
                        headers: response.headers,
                        body: data
                    });
                }
            });
            
            return; // 重要：在这里返回，避免执行后面的$done()
            
        } else {
            // 如果不是weatherkit请求，直接放行
            console.log("🔗 非WeatherKit请求，直接放行");
            $done();
        }
        
    } catch (error) {
        console.log("❌ 拦截处理出错:", error);
        // 出错时也要确保请求完成
        $done();
    }
    
} else {
    // 定时任务模式 - 显示当前GPS状态
    console.log("⏰ GPS状态检查模式");
    
    const locationData = $persistentStore.read("accurate_gps_location");
    const timestamp = $persistentStore.read("location_timestamp");
    
    if (locationData && timestamp) {
        try {
            const location = JSON.parse(locationData);
            const timeDiff = Math.round((Date.now() - parseInt(timestamp)) / 1000 / 60);
            
            console.log(`📊 当前GPS数据: ${location.latitude}, ${location.longitude}`);
            
            // 获取地址信息
            getAddressFromCoordinates(location.latitude, location.longitude)
                .then(address => {
                    $notification.post(
                        "📍 GPS定位状态", 
                        `${address.province}${address.city}${address.district}`,
                        `坐标: ${location.latitude}, ${location.longitude}\n更新时间: ${timeDiff}分钟前\n来源: ${location.source}`
                    );
                })
                .catch(error => {
                    $notification.post(
                        "📍 GPS定位状态", 
                        `坐标: ${location.latitude}, ${location.longitude}`,
                        `数据来源: ${location.source}\n更新时间: ${timeDiff}分钟前`
                    );
                });
            
        } catch (e) {
            console.log("❌ 数据解析失败:", e);
            $notification.post("❌ GPS状态检查失败", "数据解析错误", e.message);
        }
    } else {
        console.log("❌ 无GPS定位数据");
        $notification.post(
            "📍 GPS定位状态", 
            "等待定位数据",
            "请打开系统天气App触发GPS定位"
        );
    }
    
    $done();
}

// 根据坐标获取地址信息
function getAddressFromCoordinates(lat, lng) {
    return new Promise((resolve, reject) => {
        const TENCENT_TOKEN = "F7NBZ-MC3R3-6AV3J-RR75X-KKDTE-EKFLQ";
        const geocoderUrl = `https://apis.map.qq.com/ws/geocoder/v1/?key=${TENCENT_TOKEN}&location=${lat},${lng}`;
        
        $httpClient.get(geocoderUrl, function(error, response, data) {
            if (error) {
                reject(error);
                return;
            }
            
            try {
                const result = JSON.parse(data);
                if (result.status === 0) {
                    const address = result.result.address_component;
                    resolve({
                        province: address.province,
                        city: address.city,
                        district: address.district,
                        street: address.street || ""
                    });
                } else {
                    reject(new Error("逆地理编码失败"));
                }
            } catch (e) {
                reject(e);
            }
        });
    });
}
