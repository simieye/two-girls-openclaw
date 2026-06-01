/**
 * ============================================================
 * Two Girls Brew (两女孩精酿) - 业务知识库
 * 基于真实业务图片分析提取的结构化知识
 * ============================================================
 * 
 * 【品牌信息】来源: IMG_20260530_222957.jpg, IMG_20260530_222803.jpg
 * - 品牌名: TWO GIRLS (两女孩)
 * - Slogan: THE LIFETIME OF LOVE
 * - 成立: Est.2012
 * - 主营: 精酿啤酒 Craft Beer + CBBQ 烧烤
 * - 产品线: 生啤(龙头) + 罐装(TWO GIRLS系列) + BBQ烧烤 + 小食
 * 
 * 【门店网络】来源: wx_camera_1780129458073.jpg, mmexport1780188214161.jpg
 * - 旗舰店: TWO GIRLS CRAFT BEER × CBBQ (27个生啤龙头)
 *   - 位置: 商场一楼临街, 大面积玻璃窗, 工业风装修
 *   - 特色: 圆形灯饰阵列, 红色氛围灯光, 开放式酒墙展示27款生啤
 * - 门店菜单: 1-27号龙头, 每款显示IBU/OG/vol/价格
 *   - 左屏: 1-13号 (双倍干投浑浊IPA、02出岫、脑子弱麻等)
 *   - 右屏: 14-27号 (牛比克恐龙龙、殿、橡皮火车等)
 *   - BBQ菜单: 烤串/烤肉/小食/主食
 * - 艾尔拉格合作门店: "生啤一站式服务" 分销点
 * 
 * 【产品矩阵】来源: mmexport1780188194479.jpg, mmexport1780188190669.jpg, mmexport1780188140400.jpg 等
 * - 罐装产品线:
 *   - TWO GIRLS GREEN SPIN (绿色罐) - IPA系列
 *   - TWO GIRLS RED (红色罐) - 特酿系列  
 *   - 5.20 荣耀看花 皮尔森
 * - 生啤酒单(年会33+款): 
 *   - 浑合理论 双倍拉德勒IPA 8.4%vol IBU:20
 *   - 双城记·琥珀科隆 4%vol
 *   - 红心芭乐五重奏 酸艾尔 4.5%vol OG:14
 *   - K.A.S三倍干投三倍IPA 9.4%vol OG:20
 *   - 酿造都城 泽迪IPA 7.1%vol / 8.1%vol
 *   - 蜂蜜酒 5.7%vol
 *   - 应世TDH 双倍浑浊IPA 8.2%vol IBU:70
 *   - 酸味主义 酸浑浊IPA 5.2%vol OG:20
 *   ...共33款+
 * - 配套产品:
 *   - CBBQ烧烤: 烤串(牛肉/羊肉/鸡肉/海鲜)/烤蔬菜/烤主食
 *   - 小食拼盘: 多种冷盘/热食组合
 *   - 会员价: 杯Y35/Y45/Y48/Y68/Y98/Y298/Y398 (不同规格)
 * 
 * 【活动运营】来源: mmexport1780187658049.jpg ~ mmexport1780187679037.jpg
 * - 福建精酿第十届年会 (主办方):
 *   - 时间: 12月19日 16:00-24:00
 *   - 地点: 迷待爵士酒馆(旗舰店)
 *   - 规模: 全国30+/40+厂牌, 厦门市思明区
 *   - 票价: 早鸟¥99 / 现场¥128 (原价¥388)
 *   - 内容: CRAFT BEER + SNACK + MUSIC
 *   - 合作方: 思明区商务局/筼筜街道办事处/AEB赞助商
 * - 快闪市集活动:
 *   - TWO GIRLS 烧烤吧 快闪摊位 (粉色帐篷+黑色横幅)
 *   - 4头生啤机 + 烧烤食材展示
 *   - JazzLive音乐现场 + DJ打碟
 *   - 现场互动: 举杯合影/歌手表演/人群狂欢
 * - 啤酒节模式:
 *   - 户外广场多帐篷矩阵
 *   - 长条品酒台(数十个龙头一字排开)
 *   - 各品牌海报墙展示
 *   - DJ现场 + 歌手驻唱
 
 * 【供应链】从图片推断:
 * - 自有酿酒设备: 可见发酵罐/不锈钢桶
 * - 冷链配送: 蓝色保温箱用于运输生啤
 * - 罐装生产线: 批量生产TWO GIRLS罐装
 * - 分销网络: 艾尔拉格等多家合作门店
 * 
 * 【目标体系】
 * - 核心目标: 业绩销量增长 (GMV ↑, 复购率 ↑, 会员数 ↑)
 * - 线上引流 → 到店体验 → 复购留存 全闭环
 * - 有赞微商城 + 门店小程序 + 总部系统 数据互通
 */

const knowledgeBase = {
  // ========== 品牌 ==========
  brand: {
    name: 'TWO GIRLS',
    nameCn: '两女孩精酿',
    slogan: 'THE LIFETIME OF LOVE',
    established: 2012,
    logo: '圆形徽章 - 麦穗+啤酒杯图案',
    colors: {
      primary: '#E91E63',      // 品牌粉红
      secondary: '#1A1A2E',    // 深夜黑
      accent: '#FFD700',       // 金色
      highlight: '#00BCD4'     // 青色点缀
    },
    tags: ['精酿啤酒', 'CBBQ', 'Craft Beer', '女生友好', '社交空间']
  },

  // ========== 产品矩阵 ==========
  products: {
    // 生啤 - 门店龙头
    draftBeer: [
      { id: 1, name: '双倍干投浑浊', nameEn: 'DDH HAZY IPA', style: 'IPA', abv: '6.3%', ibu: null, og: null, price: 35, tap: true },
      { id: 2, name: '02出岫', style: '浑浊IPA', abv: '7.5%', ibu: 40, og: null, price: 45, tap: true },
      { id: 3, name: '脑子弱麻', style: '酸艾尔', abv: '4.3%', ibu: 18, og: null, price: 30, tap: true },
      { id: 4, name: '草廊臼', style: '酸艾尔小样', abv: null, ibu: 10, og: 15, price: 35, tap: true },
      { id: 5, name: '琥珀艾尔', style: '琥珀艾尔', abv: '6.1%', ibu: null, og: null, price: 48, tap: true },
      { id: 6, name: '比利时三料', style: '三料', abv: '8.5%', ibu: null, og: null, price: 58, tap: true },
      { id: 7, name: '燕麦世涛', style: '世涛', abv: '5.4%', ibu: 22, og: null, price: 35, tap: true },
      { id: 8, name: '可爱喝原浆', style: '原浆', abv: null, ibu: 13, og: null, price: 30, tap: true },
      { id: 9, name: '馥卷新西兰', style: '新西兰IPA', abv: '6.5%', ibu: null, og: null, price: 50, tap: true },
      { id: 10, name: '神秘酒款', style: '特酿', abv: '5.2%', ibu: null, og: null, price: 40, tap: true },
      { id: 11, name: '草莓花昔', style: '水果啤酒', abv: '3.4%', ibu: null, og: null, price: 35, tap: true },
      { id: 12, name: '鲁花比耐时', style: '拉格', abv: '4.1%', ibu: null, og: null, price: 28, tap: true },
      { id: 13, name: '路口社区', style: '淡色艾尔', abv: '3.5%', ibu: 25, og: null, price: 28, tap: true },
      { id: 14, name: '牛比克恐龙龙', style: '恐龙龙', abv: '6.2%', ibu: 62, og: null, price: 55, tap: true },
      { id: 15, name: '殿', style: '酸IPA', abv: '6.4%', ibu: 72, og: null, price: 58, tap: true },
      { id: 16, name: '橡皮火车', style: '酸IPA', abv: '6.1%', ibu: 43, og: null, price: 48, tap: true },
      { id: 17, name: '丘比特', style: '小麦', abv: '4.1%', ibu: 10, og: null, price: 30, tap: true },
      { id: 18, name: '不比提你许', style: 'IPA', abv: '7.1%', ibu: 40, og: null, price: 48, tap: true },
      { id: 19, name: '比提时小美', style: '拉格', abv: '4.2%', ibu: null, og: null, price: 28, tap: true },
      { id: 20, name: '德式皮尔森', style: '皮尔森', abv: '5.0%', ibu: null, og: null, price: 32, tap: true },
      { id: 21, name: '龙井小茶', style: '绿茶艾尔', abv: null, ibu: null, og: null, price: 35, tap: true },
      { id: 22, name: '楚爵IPA', style: 'IPA', abv: '6.4%', ibu: null, og: null, price: 48, tap: true },
      { id: 23, name: '甜东西', style: '水果', abv: null, ibu: null, og: null, price: 35, tap: true },
      { id: 24, name: '好东西', style: '特酿', abv: null, ibu: null, og: null, price: 38, tap: true },
      { id: 25, name: '麦香尼尔森', style: '尼尔森', abv: null, ibu: null, og: null, price: 42, tap: true },
      { id: 26, name: '勇力主张', style: 'IPA', abv: null, ibu: null, og: null, price: 48, tap: true },
      { id: 27, name: '', style: '特酿', abv: null, ibu: null, og: null, price: null, tap: true }
    ],
    
    // 年会/活动专属酒单
    eventBeers: [
      { id: 1, brewery: '浑合理论', name: '双倍拉德勒IPA', alias: '慌繁么么(下班了)', style: '双打', abv: '8.4%', ibu: 20, og: 2 },
      { id: 2, brewery: '双城记', name: '琥珀科隆', alias: '重返太行双倍干投泽浊', style: 'DDHIPA', abv: '4%/7%', ibu: null, og: null },
      { id: 3, brewery: '红心芭乐', name: '五重奏', alias: '老司机IPA', style: '美式IPA', abv: '6.8%', ibu: 19, og: null },
      { id: 4, brewery: '北平机器', name: '明前龙井', alias: '帝都格拉格', style: '小麦', abv: '4.5%', ibu: 11, og: null },
      { id: 5, brewery: 'E.T.', name: '心意流', alias: '禅意流', style: '硬冰茶', abv: '2.6%', ibu: null, og: 7.8 },
      { id: 6, brewery: '小荷菡', name: '原谅他', alias: '芭乐情歌', style: '果啤', abv: '4%/3%', ibu: 20, og: 8 },
      { id: 8, brewery: '永续低语', name: '鲜脆IPA', alias: '非静止', style: '浑浊IPA', abv: '6.4%/7.1%', ibu: 37, og: 15.5 },
      { id: 9, brewery: '成功大道', name: '现代西海岸IPA', alias: '观看小麦', style: '小麦', abv: '5.3%/4.2%', ibu: 50, og: 10.5 },
      { id: 18, brewery: 'K.A.S三倍干投', name: '三倍IPA', alias: '金枫黄大茶利隧', style: '科隆', abv: '9.4%/4.5%', ibu: 20, og: 11.5 },
      { id: 19, brewery: '跃山2.0', name: '西海岸双倍IPA', alias: '梅莓焙焙', style: '古斯', abv: '7.9%/4%', ibu: 60, og: 18 },
      { id: 20, brewery: '芭乐遇油柑', name: '西打', alias: '青提茉莉冷萃茶', style: '无醇', abv: '4.0%/0%', ibu: null, og: null },
      { id: 21, brewery: '郁墨都市', name: '泽迪IPA', alias: '浓伽加信', style: '泽迪IPA', abv: '7.1%/8.1%', ibu: null, og: null },
      { id: 22, brewery: '篙/金辉微醺', name: '蜂蜜酒', alias: '热岛来信/蜂蜜酒', style: '蜂蜜酒', abv: '5.7%', ibu: null, og: null },
      { id: 23, brewery: '大犀宏图', name: '酸浑浊IPA', alias: '你今日饮咗未', style: '柏林酸小麦', abv: '5.8%/4.8%', ibu: 35, og: 15 },
      { id: 24, brewery: '应世TDH', name: '双倍浑浊IPA', alias: '芧 德式皮尔森', style: '德式皮尔森', abv: '8.2%/5.5%', ibu: 70, og: 20 },
      { id: 25, brewery: '酸味主义', name: '酸浑浊IPA', alias: '绿林茶香', style: '西打', abv: '5.2%/3.5%', ibu: 20, og: null },
      { id: 26, brewery: '泽迪拉格', name: '思维过载DDH SOUR IPA', alias: '酸IPA', abv: '7%/7.6%', ibu: null, og: '16.6/22.1' },
      { id: 27, brewery: '柏林童话', name: '夏日终曲', alias: '古斯', style: '柏林酸小麦', abv: '3.5%/4.2%', ibu: null, og: null },
      { id: 28, brewery: '降躁-BIUBIU蟋桃西打', name: '片甲不留-石楠柏林酸小麦', alias: '柏林酸小麦', abv: '2.6%/4.5%', ibu: 10, og: '4/12' },
      { id: 29, brewery: '北欧摩登', name: '桃子酸艾尔', alias: '摩登淡色艾尔', style: '淡色艾尔', abv: '4.5%/5.5%', ibu: null, og: 13 },
      { id: 30, brewery: '冰拉格', name: '北欧摩登 草莓酸艾尔', alias: '酸艾尔', style: '酸艾尔', abv: '4.5%/4.5%', ibu: null, og: 12.9 },
      { id: 31, brewery: '假日波尔卡', name: '柚子速递', alias: '柏林酸小麦', style: '柏林酸小麦', abv: '4%/4.5%', ibu: 5, og: 5 },
      { id: 32, brewery: '西安TRIBE', name: 'DDH 西海岸 IPA', alias: '三分醉-青柠凤梨木子西打', style: '西打', abv: '6.5%/2.5%', ibu: 35, og: null }
    ],

    // 罐装产品
    cannedBeer: [
      { name: 'TWO GIRLS GREEN SPIN', series: 'IPA系列', color: 'green', canType: '330ml铝罐' },
      { name: 'TWO GIRLS RED', series: '特酿系列', color: 'red', canType: '330ml铝罐' },
      { name: '5.20荣耀看花 皮尔森', series: '季节限定', canType: '330ml铝罐', special: '520限定款' }
    ],

    // BBQ烧烤菜单
    bbqMenu: {
      categories: ['烤串类', '烤肉类', '海鲜类', '烤蔬菜', '主食', '小吃', '饮品'],
      items: [
        { category: '烤串类', items: ['牛肉串', '羊肉串', '鸡肉串', '五花肉', '烤鸡翅'] },
        { category: '烤肉类', items: ['厚切牛排', '猪肋排', '羊腿', '烤整鸡'] },
        { category: '海鲜类', items: ['烤虾', '烤鱿鱼', '烤扇贝', '生蚝'] },
        { category: '烤蔬菜', items: ['烤玉米', '烤茄子', '烤土豆', '彩椒串'] },
        { category: '主食', items: ['炒饭', '炒面', '烤面包片'] },
        { category: '小吃', items: ['薯条', '沙拉', '冷切拼盘', '芝士盘'] }
      ]
    },

    // 定价体系
    pricing: {
      draft: { small: 35, medium: 45, large: 48, flight: 68, tower: 298, megaTower: 398 },  // 单位: 元
      canned: { single: 18, sixPack: 99, twelvePack: 180 },
      bbq: { skewerRange: [8, 25], plateRange: [38, 128], setMeal: [168, 288, 388] },
      event: { earlyBird: 99, regular: 128, original: 388, vip: 288 },
      membership: {
        levels: ['普通会员', '银卡', '金卡', '黑卡'],
        discount: [1.0, 0.95, 0.9, 0.85],
        benefits: ['无', '生日礼', '生日礼+优先预约', '全部权益+免费品鉴']
      }
    }
  },

  // ========== 门店网络 ==========
  stores: {
    flagship: {
      name: 'TWO GIRLS CRAFT BEER x CBBQ',
      type: 'flagship',
      features: ['27个生啤龙头', '工业风装修', '开放式酒墙', '圆形灯饰阵列', '红蓝氛围光', '大面积落地窗'],
      location: { city: '厦门', district: '思明区', address: '商场一楼临街', landmark: '近JazzLive/SM城市广场' },
      capacity: { seats: '50+', taps: 27, screens: 2 },
      hours: { weekday: '17:00-02:00', weekend: '14:00-03:00', event: '16:00-24:00' },
      atmosphere: '年轻潮流/社交聚会/DJ音乐/观景露台'
    },
    partnerStores: [
      { name: '艾尔拉格', type: 'distributor', feature: '生啤一站式服务', location: '分销合作店' },
      { name: '迷待爵士酒馆', type: 'eventVenue', feature: '活动举办地', location: '思明区筼筜天虹购物广场L2' }
    ]
  },

  // ========== 活动/事件 ==========
  events: {
    annualConference: {
      name: '福建精酿第十届年会',
      edition: 10,
      date: '2025-12-19',
      time: '16:00-24:00',
      venue: '迷待爵士酒馆(旗舰店)',
      organizer: 'Two Girls Brew (主办)',
      sponsors: ['AEB', '思明区商务局', '筼筜街道办事处'],
      scale: '全国30+/40+厂牌参与',
      ticket: { earlyBird: 99, onsite: 128, original: 388 },
      content: ['CRAFT BEER', 'SNACK', 'MUSIC', 'DJ现场', '歌手表演'],
      promotionChannels: ['大众点评购票', '美团购票', '扫码购买', '线下海报'],
      expectedAttendance: 500,
      brandsParticipating: [
        '制乐厂INJOY', '放FOUN', '山丘麦啤', 'TIMING时末', '小发岌', '京A', 'alus',
        '+BROTHERS+', 'BREWING', 'TRIP SMITH', '有什酿造', 'corde', '木猴子',
        '纸飞鹅酿造', 'Heineken', 'E.T.', 'YE BREWING', '北平机器', 'APPENZELLER BEER',
        '牛啤堂', 'Poppels', 'Foli', 'WILD WEST', 'Hops Farm', 'Gin Craft',
        '沉降解惑', 'QIN CRAFT'
      ]
    },
    popUpMarket: {
      name: '快闪市集/啤酒节',
      format: '户外广场多帐篷矩阵',
      setup: [
        '粉色TWO GIRLS帐篷(主摊)', '红色品牌帐篷矩阵', '长条品酒台(数十龙头)',
        '各品牌海报墙', 'DJ台/音响设备', '互动打卡点'
      ],
      activities: ['现场品酒', 'DJ打碟', '歌手驻唱', '举杯互动', '拍照分享'],
      targetAudience: ['Z世代年轻人', '精酿爱好者', '社交达人', '美食探索者']
    }
  },

  // ========== 渠道 ==========
  channels: {
    online: {
      youzanMiniShop: { name: '有赞微商城', purpose: '商品售卖/会员管理/营销发券/订单履约' },
      youzanStoreApp: { name: '有赞门店下单小程序', purpose: '到店自提/外卖配送/排队取号/桌边扫码' },
      xiaohongshu: { name: '小红书', purpose: '种草引流/内容营销/KOL合作/话题标签' },
      douyin: { name: '抖音', purpose: '短视频/直播带货/同城推广/达人探店' },
      dianping: { name: '大众点评', purpose: '店铺评价/团购套餐/榜单排名/用户UGC' },
      wechat: { name: '微信公众号+社群', purpose: '私域运营/活动通知/会员服务/内容推送' }
    },
    offline: {
      flagshipStore: { type: '体验中心', conversion: '流量→会员→复购' },
      popUpEvents: { type: '获客渠道', conversion: '路人→关注→到店' },
      partnerBars: { type: '分销渠道', conversion: '尝鲜→偏好→直购' },
      festivals: { type: '品牌曝光', conversion: '认知→兴趣→行动' }
    }
  },

  // ========== 业绩目标体系 ==========
  kpiTargets: {
    // 月度核心指标
    monthly: {
      gmv: { target: 500000, unit: '元', description: '月度总销售额' },
      orderCount: { target: 8000, unit: '单', description: '月度订单总量' },
      newMembers: { target: 500, unit: '人', description: '月度新增会员数' },
      retentionRate: { target: 0.45, unit: '%', description: '会员月度复购率' },
      avgTicket: { target: 120, unit: '元', description: '平均客单价' },
      onlineToOfflineRate: { target: 0.15, unit: '%', description: '线上引流到店转化率' }
    },
    // 季度增长目标
    quarterly: {
      gmvGrowth: { target: 0.25, unit: '%', description: 'GMV季度环比增长率' },
      memberGrowth: { target: 0.30, unit: '%', description: '会员数季度增长率' },
      eventRevenue: { target: 200000, unit: '元', description: '单次大型活动营收目标' },
      channelMix: { offline: 0.60, online: 0.25, events: 0.15 }  // 收入占比
    }
  },

  // ========== OpenClaw调用逻辑映射 ==========
  openClawCommands: {
    // 统一指令格式: <领域>:<动作>:<对象>[:参数]
    patterns: {
      // 业绩相关
      sales: {
        report: 'sales:report:daily|weekly|monthly',
        forecast: 'sales:forecast:next_week|next_month',
        target: 'sales.target:set:<amount>:<period>',
        alert: 'sales.alert:low_performance:<threshold>'
      },
      // 营销相关
      marketing: {
        campaign: 'marketing.campaign:launch:<type>[:<channel>]',
        coupon: 'marketing.coupon:create|distribute:<type>[:<count>]',
        content: 'marketing.content:generate:<platform>[:<topic>]',
        event: 'marketing.event:create|execute:<type>'
      },
      // 门店相关
      store: {
        inventory: 'store.inventory:sync|check|alert',
        menu: 'store.menu:update|rotate:<tap_id>',
        staff: 'store.staff:schedule|attendance',
        review: 'store.review:monitor|respond'
      },
      // 供应链相关
      supply: {
        purchase: 'supply.purchase:create|track:<item>',
        delivery: 'supply.delivery:schedule|track',
        brew: 'supply.brew:start|monitor:<batch_id>',
        quality: 'supply.quality:check:<batch_id>'
      },
      // 会员相关
      member: {
        acquire: 'member.acquire:<channel>',
        engage: 'member.engage:message|reward[:<segment>]',
        analyze: 'member.analyze:cohort|rfm|churn'
      }
    }
  }
};

module.exports = knowledgeBase;
