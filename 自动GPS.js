// 名称: 自动GPS定位监控（无需打开天气App）
// 描述: 使用Loon内置位置API自动获取GPS，5:00-20:00期间工作
// 作者: Assistant
// 工具: Loon

console.log("🎯 自动GPS定位监控启动");

function main() {
    const now = new Date();
    const currentHour = now.getHours();
    
    // 检查当前时间是否在5:00-20:00之间
    const isUpdateTime = currentHour >= 5 && currentHour < 20;
    
    console.log(`🕒 当前时间: ${currentHour}点, 更新时段: ${isUpdateTime ? '是' : '否'}`);
    
    if (isUpdateTime) {
        // 在更新时段内，直接获取GPS位置
        getGPSLocation();
    } else {
        // 非更新时段，只显示状态
        showSilentStatus();
    }
}

function getGPSLocation() {
    console.log("📍 开始获取GPS位置...");
    
    // 使用Loon内置的位置获取功能
    $loon.getLocation(function(location) {
        if (location && location.latitude && location.longitude) {
            console.log(`✅ 获取到GPS坐标: ${location.latitude}, ${location.longitude}`);
            
            // 保存GPS数据
            const locationData = {
                latitude: location.latitude,
                longitude: location.longitude,
                source: "loon_direct_location",
                timestamp: Date.now(),
                accuracy: location.horizontalAccuracy ? "高精度" : "标准精度"
            };
            
            $persistentStore.write(JSON.stringify(locationData), "accurate_gps_location");
            $persistentStore.write(Date.now().toString(), "location_timestamp");
            
            console.log("💾 GPS数据已保存");
            
            // 获取详细地址
            getDetailedAddress(location.latitude, location.longitude);
            
        } else {
            console.log("❌ 获取GPS位置失败");
            $notification.post(
                "📍 GPS定位状态",
                "❌ 定位失败",
                "无法获取当前位置信息\n请检查位置权限设置"
            );
            $done();
        }
    });
}

function getDetailedAddress(lat, lng) {
    const TENCENT_TOKEN = "F7NBZ-MC3R3-6AV3J-RR75X-KKDTE-EKFLQ";
    const geocoderUrl = `https://apis.map.qq.com/ws/geocoder/v1/?key=${TENCENT_TOKEN}&location=${lat},${lng}`;
    
    console.log("🗺️ 获取详细地址信息...");
    
    $httpClient.get(geocoderUrl, function(error, response, data) {
        let addressText = "未知地址";
        
        if (!error && response.status === 200) {
            try {
                const result = JSON.parse(data);
                if (result.status === 0) {
                    const address = result.result.address_component;
                    addressText = `${address.province || ''}${address.city || ''}${address.district || ''}`;
                    
                    if (address.street) {
                        addressText += `${address.street}`;
                    }
                    if (address.street_number) {
                        addressText += `${address.street_number}`;
                    }
                    
                    // 保存地址到缓存
                    $persistentStore.write(addressText, "location_address");
                    console.log("✅ 地址解析成功:", addressText);
                } else {
                    console.log("❌ 逆地理编码失败");
                    addressText = `坐标: ${lat}, ${lng}`;
                }
            } catch (e) {
                console.log("❌ 地址数据解析失败:", e);
                addressText = `坐标: ${lat}, ${lng}`;
            }
        } else {
            console.log("❌ 地址请求失败:", error);
            addressText = `坐标: ${lat}, ${lng}`;
        }
        
        // 显示通知
        showLocationNotification(addressText, lat, lng, 0);
    });
}

function showLocationNotification(address, lat, lng, age) {
    $notification.post(
        "📍 GPS定位状态",
        `${address}`,
        `更新时间: ${age}分钟前\n数据来源: loon_direct_location\n坐标精度: 高精度 GPS\n经纬度: ${lat}, ${lng}`
    );
    $done();
}

function showSilentStatus() {
    const gpsData = $persistentStore.read("accurate_gps_location");
    const timestamp = $persistentStore.read("location_timestamp");
    
    if (gpsData && timestamp) {
        try {
            const location = JSON.parse(gpsData);
            const timeDiff = Math.round((Date.now() - parseInt(timestamp)) / 60000);
            const currentHour = new Date().getHours();
            const address = $persistentStore.read("location_address") || `坐标: ${location.latitude}, ${location.longitude}`;
            
            console.log(`💤 非更新时段(${currentHour}点)，静默模式`);
            
            // 只在数据非常陈旧时才发送通知
            if (timeDiff > 360) { // 6小时以上
                $notification.post(
                    "📍 GPS定位状态",
                    `${address}`,
                    `更新时间: ${timeDiff}分钟前\n数据来源: ${location.source}\n坐标精度: 高精度 GPS\n经纬度: ${location.latitude}, ${location.longitude}\n\n💤 非更新时段，明日5点后自动更新`
                );
            } else {
                // 数据不算太旧，完全静默
                console.log(`💤 数据年龄${timeDiff}分钟，保持静默`);
            }
        } catch (e) {
            console.log("❌ 静默状态检查失败:", e);
        }
    } else {
        console.log("❌ 无GPS数据可用");
        $notification.post(
            "📍 GPS定位状态",
            "等待定位数据",
            "请在更新时段(5:00-20:00)自动获取"
        );
    }
    $done();
}

main();
