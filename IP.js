// 名称: 腾讯地图定位测试
// 描述: 测试腾讯地图定位准确性
// 作者: Assistant

const TENCENT_TOKEN = "F7NBZ-MC3R3-6AV3J-RR75X-KKDTE-EKFLQ";

function main() {
    console.log("📍 开始腾讯地图定位测试...");
    
    // 方法1: IP定位
    const ipUrl = `https://apis.map.qq.com/ws/location/v1/ip?key=${TENCENT_TOKEN}`;
    
    $httpClient.get(ipUrl, function(error, response, data) {
        if (error) {
            console.log("❌ IP定位请求失败: " + error);
            $notification.post("定位测试失败", "IP定位请求错误", error);
            $done();
            return;
        }
        
        try {
            const result = JSON.parse(data);
            
            if (result.status === 0) {
                const location = result.result;
                const ip = location.ip;
                const lat = location.location.lat;
                const lng = location.location.lng;
                const province = location.ad_info.province;
                const city = location.ad_info.city;
                const district = location.ad_info.district;
                const adcode = location.ad_info.adcode;
                
                console.log(`✅ IP定位成功:`);
                console.log(`   IP: ${ip}`);
                console.log(`   坐标: ${lat}, ${lng}`);
                console.log(`   位置: ${province} ${city} ${district}`);
                console.log(`   行政区代码: ${adcode}`);
                
                // 发送通知显示结果
                $notification.post(
                    "📍 腾讯地图定位测试",
                    `IP: ${ip}`,
                    `位置: ${province}${city}${district}\n坐标: ${lat}, ${lng}\n\n点击测试逆地理编码`,
                    {
                        "open-url": `https://apis.map.qq.com/ws/geocoder/v1/?key=${TENCENT_TOKEN}&location=${lat},${lng}`
                    }
                );
                
                // 可选: 自动进行逆地理编码测试
                testReverseGeocode(lat, lng);
                
            } else {
                console.log("❌ IP定位返回错误: " + result.message);
                $notification.post("定位测试失败", "IP定位返回错误", result.message);
                $done();
            }
            
        } catch (e) {
            console.log("❌ 数据解析失败: " + e.message);
            $notification.post("定位测试失败", "数据解析错误", e.message);
            $done();
        }
    });
}

// 逆地理编码测试函数
function testReverseGeocode(lat, lng) {
    console.log("🔄 开始逆地理编码测试...");
    
    const reverseUrl = `https://apis.map.qq.com/ws/geocoder/v1/?key=${TENCENT_TOKEN}&location=${lat},${lng}`;
    
    $httpClient.get(reverseUrl, function(error, response, data) {
        if (error) {
            console.log("❌ 逆地理编码请求失败: " + error);
            $done();
            return;
        }
        
        try {
            const result = JSON.parse(data);
            
            if (result.status === 0) {
                const address = result.result.address_component;
                const formattedAddress = result.result.formatted_addresses ? result.result.formatted_addresses.recommend : "无推荐地址";
                
                console.log("✅ 逆地理编码成功:");
                console.log(`   国家: ${address.nation}`);
                console.log(`   省份: ${address.province}`);
                console.log(`   城市: ${address.city}`);
                console.log(`   区县: ${address.district}`);
                console.log(`   街道: ${address.street}`);
                console.log(`   详细地址: ${formattedAddress}`);
                
                // 发送详细结果通知
                setTimeout(() => {
                    $notification.post(
                        "🔄 逆地理编码结果",
                        `${address.province}${address.city}${address.district}`,
                        `街道: ${address.street}\n推荐地址: ${formattedAddress}\n\nIP定位 vs 逆地理编码对比完成`
                    );
                }, 1000);
                
            } else {
                console.log("❌ 逆地理编码返回错误: " + result.message);
            }
            
        } catch (e) {
            console.log("❌ 逆地理编码数据解析失败: " + e.message);
        }
        
        $done();
    });
}

// 启动测试
main();
