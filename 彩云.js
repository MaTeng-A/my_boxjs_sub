// 名称: 诗意天气日报 (苹果定位版)
// 描述: 基于苹果天气精确定位，支持诗意天气和明日预报
// 作者: Assistant
// 更新时间: 2025-10-09

// 配置您的 API 密钥
const CAIYUN_TOKEN = "iaJd9yTvsg3496vi"; // 彩云天气 Token
const TENCENT_TOKEN = "F7NBZ-MC3R3-6AV3J-RR75X-KKDTE-EKFLQ"; // 腾讯地图 Token
const TIANAPI_KEY1 = "8fb6b3bc5bbe9ee420193601d13f9162"; // 天行数据 Key1
const TIANAPI_KEY2 = "8fb6b3bc5bbe9ee420193601d13f9162"; // 天行数据 Key2

// 检查是否是晚上 22:17 及之后
function isLastRunTime() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    return hour > 22 || (hour === 22 && minute >= 17);
}

// 检查是否是今天第一次运行
function isFirstRunToday() {
    const today = new Date().toDateString();
    const lastRunDate = $persistentStore.read("lastRunDate");
    if (lastRunDate !== today) {
        $persistentStore.write(today, "lastRunDate");
        return true;
    }
    return false;
}

// 检查是否在早晨时间段 (5:00-12:00)
function isMorningTime() {
    const hour = new Date().getHours();
    return hour >= 5 && hour < 12;
}

// 获取苹果天气定位信息
function getAppleWeatherLocation() {
    const locationJson = $persistentStore.read("apple_weather_location");
    if (!locationJson) {
        console.log("❌ 未找到苹果天气定位信息");
        return null;
    }
    
    try {
        const location = JSON.parse(locationJson);
        if (location.latitude && location.longitude) {
            console.log(`📍 苹果天气定位: ${location.latitude}, ${location.longitude}`);
            return location;
        }
    } catch (e) {
        console.log("❌ 苹果天气位置数据解析失败");
    }
    return null;
}

// 逆地理编码获取地址信息
function reverseGeocode(lat, lng, callback) {
    const url = `https://apis.map.qq.com/ws/geocoder/v1/?key=${TENCENT_TOKEN}&location=${lat},${lng}`;
    
    $httpClient.get(url, function(error, response, data) {
        if (error) {
            console.log("📍 逆地理编码失败");
            callback(null);
            return;
        }
        
        try {
            const result = JSON.parse(data);
            if (result.status === 0) {
                const address = result.result.address_component;
                console.log(`📍 逆地理编码结果: ${address.province}${address.city}${address.district}`);
                callback({
                    province: address.province,
                    city: address.city,
                    district: address.district
                });
            } else {
                console.log("📍 逆地理编码返回错误");
                callback(null);
            }
        } catch (e) {
            console.log("📍 逆地理编码数据解析失败");
            callback(null);
        }
    });
}

// 主函数
function main() {
    console.log("🌤️ 开始获取诗意天气信息...");
    
    const firstRunToday = isFirstRunToday();
    const isMorning = isMorningTime();
    const isLastRun = isLastRunTime();
    
    console.log(`今天第一次运行: ${firstRunToday}, 早晨时段: ${isMorning}, 最后运行时段: ${isLastRun}`);
    
    // 获取苹果天气定位
    const appleLocation = getAppleWeatherLocation();
    if (!appleLocation) {
        $notification.post("❌ 定位失败", "", "请确保已配置苹果天气定位");
        $done();
        return;
    }
    
    // 逆地理编码获取地址
    reverseGeocode(appleLocation.latitude, appleLocation.longitude, function(addressInfo) {
        if (addressInfo) {
            getCaiyunWeather(appleLocation.latitude, appleLocation.longitude, 
                           addressInfo.province, addressInfo.city, addressInfo.district, 
                           firstRunToday, isMorning, isLastRun);
        } else {
            $notification.post("❌ 地址解析失败", "", "无法获取位置地址信息");
            $done();
        }
    });
}

// 获取彩云天气数据
function getCaiyunWeather(lat, lng, province, city, district, firstRunToday, isMorning, isLastRun) {
    const weatherUrl = `https://api.caiyunapp.com/v2.6/${CAIYUN_TOKEN}/${lng},${lat}/weather?alert=true`;
    
    console.log("⏳ 获取彩云天气数据...");
    
    $httpClient.get(weatherUrl, function(error, response, data) {
        if (error) {
            handleError("天气获取失败", error);
            return;
        }
        
        try {
            const weatherData = JSON.parse(data);
            if (weatherData.status === "ok") {
                console.log("✅ 天气数据获取成功");
                if (isLastRun) {
                    processWeatherData(weatherData, province, city, district, "", "", firstRunToday, isMorning, isLastRun, true);
                } else {
                    getTianapiData(weatherData, province, city, district, firstRunToday, isMorning, isLastRun);
                }
            } else {
                handleError("天气获取失败", weatherData.error || "未知错误");
            }
        } catch (e) {
            handleError("天气数据解析失败", e.message);
        }
    });
}

// 获取天行数据 (诗句和早安语)
function getTianapiData(weatherData, province, city, district, firstRunToday, isMorning, isLastRun) {
    const skycon = weatherData.result.realtime.skycon;
    const tqtype = getTianapiWeatherType(skycon);
    
    let poetryUrl = `https://api.tianapi.com/tianqishiju/index?key=${TIANAPI_KEY1}`;
    if (tqtype) {
        poetryUrl += `&tqtype=${tqtype}`;
    }
    
    console.log("📜 获取天行数据...");
    
    $httpClient.get(poetryUrl, function(error, response, poetryData) {
        let poetry = "今日天气宜人，愿您心情舒畅。";
        if (!error) {
            try {
                const poetryJson = JSON.parse(poetryData);
                if (poetryJson.code === 200 && poetryJson.newslist && poetryJson.newslist.length > 0) {
                    poetry = poetryJson.newslist[0].content;
                    console.log("✅ 天气诗句获取成功");
                }
            } catch (e) {
                console.log("❌ 天气诗句获取失败");
            }
        }
        
        let morning = null;
        if (firstRunToday && isMorning) {
            const morningUrl = `https://api.tianapi.com/zaoan/index?key=${TIANAPI_KEY2}`;
            
            $httpClient.get(morningUrl, function(error, response, morningData) {
                if (!error) {
                    try {
                        const morningJson = JSON.parse(morningData);
                        if (morningJson.code === 200 && morningJson.newslist && morningJson.newslist.length > 0) {
                            morning = morningJson.newslist[0].content;
                            console.log("✅ 早安心语获取成功");
                        }
                    } catch (e) {
                        console.log("❌ 早安心语获取失败");
                    }
                }
                
                processWeatherData(weatherData, province, city, district, poetry, morning, firstRunToday, isMorning, isLastRun, false);
            });
        } else {
            processWeatherData(weatherData, province, city, district, poetry, morning, firstRunToday, isMorning, isLastRun, false);
        }
    });
}

// 处理天气数据并生成通知
function processWeatherData(weatherData, province, city, district, poetry, morning, firstRunToday, isMorning, isLastRun, sendTomorrow) {
    try {
        const realtime = weatherData.result.realtime;
        const hourly = weatherData.result.hourly;
        const daily = weatherData.result.daily;
        const alert = weatherData.result.alert;
        const keypoint = weatherData.result.forecast_keypoint;
        
        // 处理实时天气数据...
        const temperature = Math.round(realtime.temperature);
        const apparentTemperature = Math.round(realtime.apparent_temperature);
        const humidity = Math.round(realtime.humidity * 100);
        const windSpeed = Math.round(realtime.wind.speed);
        const windDirection = getWindDirection(realtime.wind.direction);
        const pressure = Math.round(realtime.pressure / 100);
        const visibility = (realtime.visibility / 1000).toFixed(1);
        const skycon = realtime.skycon;
        const weatherDesc = getWeatherDescription(skycon);
        const airQuality = realtime.air_quality ? realtime.air_quality.description.chn : "未知";
        const pm25 = realtime.air_quality ? Math.round(realtime.air_quality.pm25) : "未知";
        
        const comfort = realtime.life_index.comfort ? realtime.life_index.comfort.desc : "暂无数据";
        const ultraviolet = realtime.life_index.ultraviolet ? realtime.life_index.ultraviolet.desc : "暂无数据";
        
        const maxTemp = Math.round(daily.temperature[0].max);
        const minTemp = Math.round(daily.temperature[0].min);
        
        const weatherIconUrl = getWeatherIcon(skycon);
        
        // 构建通知内容
        let title, subtitle, body = "";
        
        if (isLastRun && sendTomorrow) {
            // 明日天气预报逻辑
            const tomorrowTemp = daily.temperature[1];
            const tomorrowMaxTemp = Math.round(tomorrowTemp.max);
            const tomorrowMinTemp = Math.round(tomorrowTemp.min);
            const tomorrowSkycon = daily.skycon[1].value;
            const tomorrowWeatherDesc = getWeatherDescription(tomorrowSkycon);
            
            title = "🌙 明日天气预告";
            subtitle = `📍${province}${city}${district} 明日${tomorrowWeatherDesc}`;
            
            body += `🌡️ 温度范围: ${tomorrowMinTemp}°C ~ ${tomorrowMaxTemp}°C\n`;
            body += `🌈 天气状况: ${tomorrowWeatherDesc}\n\n`;
            body += `${getDressingAdvice(tomorrowMaxTemp, tomorrowWeatherDesc)}\n`;
            body += `${getUmbrellaAdvice(tomorrowWeatherDesc)}\n\n`;
            
            if (daily.astro[1]) {
                body += `🌅 日出: ${daily.astro[1].sunrise.time}   🌇 日落: ${daily.astro[1].sunset.time}`;
            }
        } else {
            // 正常天气报告逻辑
            title = "🌤️ 诗意天气日报";
            subtitle = `📍${province}${city}${district} (${minTemp}°C~${maxTemp}°C) | ${temperature}°C | ${weatherDesc}`;
            
            if (firstRunToday && isMorning && morning) {
                body += `✨ ${morning}\n\n`;
            }
            
            body += `🌫️ 空气质量: ${airQuality}   🫧 PM2.5: ${pm25}\n`;
            body += `🌡️ 体感${comfort} ${apparentTemperature}°C   💧 湿度 ${humidity}%\n`;
            body += `🌬️ ${windDirection}风 ${windSpeed}km/h   📊 气压 ${pressure}hPa\n`;
            body += `👁️ 能见度 ${visibility}km   ☀️ 紫外线${ultraviolet}\n\n`;
            
            // 未来三小时预报
            let hourlyForecast = "";
            for (let i = 0; i < 3 && i < hourly.skycon.length; i++) {
                const hourTime = new Date(hourly.skycon[i].datetime);
                const currentHour = hourTime.getHours();
                const nextHour = currentHour + 1;
                const temp = Math.round(hourly.temperature[i].value);
                const hourSkycon = hourly.skycon[i].value;
                const hourDesc = getWeatherDescription(hourSkycon);
                hourlyForecast += `      ${currentHour.toString().padStart(2, '0')}-${nextHour.toString().padStart(2, '0')}时 ${hourDesc} ${temp}°C\n`;
            }
            
            if (hourlyForecast) {
                body += `⏰ 未来三小时预报:\n${hourlyForecast}\n`;
            }
            
            // 预警信息
            if (alert && alert.content && alert.content.length > 0) {
                body += "⚠️ 天气预警:\n";
                alert.content.forEach((alertItem, index) => {
                    if (index < 2) {
                        body += `   • ${alertItem.title}\n`;
                    }
                });
                body += "\n";
            }
            
            if (keypoint) {
                body += `💡 ${keypoint}\n`;
            }
            
            body += `📜 ${poetry}`;
        }
        
        console.log("✅ 准备发送通知");
        
        $notification.post(title, subtitle, body, {
            "icon": weatherIconUrl
        });
        
        $done();
        
    } catch (e) {
        handleError("天气数据处理失败", e.message);
    }
}

// 辅助函数 (getWeatherIcon, getWeatherDescription, getWindDirection, getDressingAdvice, getUmbrellaAdvice 等)
// 这里需要包含之前脚本中的所有辅助函数
function getWeatherIcon(skycon) {
    const iconMap = {
        "CLEAR_DAY": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/CLEAR_DAY.gif",
        "CLEAR_NIGHT": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/CLEAR_NIGHT.gif",
        "PARTLY_CLOUDY_DAY": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/PARTLY_CLOUDY_DAY.gif",
        "PARTLY_CLOUDY_NIGHT": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/PARTLY_CLOUDY_NIGHT.gif",
        "CLOUDY": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/CLOUDY.gif",
        "LIGHT_RAIN": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/LIGHT_RAIN.gif",
        "MODERATE_RAIN": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/MODERATE_RAIN.gif",
        "HEAVY_RAIN": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/HEAVY_RAIN.gif",
        "STORM_RAIN": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/STORM_RAIN.gif",
        "LIGHT_SNOW": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/LIGHT_SNOW.gif",
        "MODERATE_SNOW": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/MODERATE_SNOW.gif",
        "HEAVY_SNOW": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/HEAVY_SNOW.gif",
        "STORM_SNOW": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/HEAVY_SNOW.gif",
        "FOG": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/FOG.gif",
        "WIND": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/WIND.gif",
        "HAZE": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/HAZE.gif"
    };
    return iconMap[skycon] || "https://raw.githubusercontent.com/58xinian/icon/master/Weather/CLOUDY.gif";
}

function getWeatherDescription(skycon) {
    const descMap = {
        "CLEAR_DAY": "☀️ 晴朗", "CLEAR_NIGHT": "✨ 晴朗",
        "PARTLY_CLOUDY_DAY": "⛅ 多云", "PARTLY_CLOUDY_NIGHT": "☁️ 多云",
        "CLOUDY": "☁️ 阴天", "LIGHT_RAIN": "🌦️ 小雨", 
        "MODERATE_RAIN": "🌧️ 中雨", "HEAVY_RAIN": "⛈️ 大雨",
        "STORM_RAIN": "🌩️ 暴雨", "LIGHT_SNOW": "❄️ 小雪",
        "MODERATE_SNOW": "🌨️ 中雪", "HEAVY_SNOW": "☃️ 大雪",
        "STORM_SNOW": "❄️ 暴雪", "FOG": "🌫️ 雾天",
        "WIND": "💨 大风", "HAZE": "😷 雾霾"
    };
    return descMap[skycon] || "🌤️ 未知";
}

function getWindDirection(degree) {
    const directions = ["北", "北东北", "东北", "东东北", "东", "东东南", "东南", "南东南", 
                       "南", "南西南", "西南", "西西南", "西", "西西北", "西北", "北西北"];
    const index = Math.round(((degree %= 360) < 0 ? degree + 360 : degree) / 22.5) % 16;
    return directions[index];
}

function getDressingAdvice(temperature, weatherDesc) {
    const temp = parseInt(temperature);
    if (temp >= 28) return "👕 天气炎热，建议穿短袖、短裤等清凉夏季服装";
    else if (temp >= 24) return "👕 天气较热，建议穿短袖、薄长裤等夏季服装";
    else if (temp >= 18) return "👕 温度舒适，建议穿长袖、薄外套等春秋过渡装";
    else if (temp >= 12) return "🧥 天气较凉，建议穿夹克、薄毛衣等春秋服装";
    else if (temp >= 5) return "🧥 天气冷，建议穿棉衣、厚外套等冬季服装";
    else return "🧥 天气寒冷，建议穿羽绒服、厚棉衣等保暖服装";
}

function getUmbrellaAdvice(weatherDesc) {
    if (weatherDesc.includes("雨") || weatherDesc.includes("雪")) return "🌂 明天有降水，记得带伞哦！";
    else if (weatherDesc.includes("阴") || weatherDesc.includes("云")) return "🌂 明天可能转阴，建议备伞以防万一";
    else return "☀️ 明天天气晴朗，无需带伞";
}

function getTianapiWeatherType(skycon) {
    const typeMap = {
        "CLEAR_DAY": 9, "CLEAR_NIGHT": 9,
        "PARTLY_CLOUDY_DAY": 2, "PARTLY_CLOUDY_NIGHT": 2,
        "CLOUDY": 10, "LIGHT_RAIN": 3, "MODERATE_RAIN": 3,
        "HEAVY_RAIN": 3, "STORM_RAIN": 8, "LIGHT_SNOW": 4,
        "MODERATE_SNOW": 4, "HEAVY_SNOW": 4, "STORM_SNOW": 4,
        "FOG": 7, "WIND": 1, "HAZE": 7
    };
    return typeMap[skycon] || null;
}

function handleError(title, message) {
    console.error(`❌ 错误: ${title} - ${message}`);
    $notification.post("❌ " + title, message, "");
    $done();
}

// 启动主函数
main();