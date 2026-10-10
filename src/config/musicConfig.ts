import type { MusicPlayerConfig } from "../types/musicConfig";

// 音乐播放器配置
export const musicPlayerConfig: MusicPlayerConfig = {
	// 是否在导航栏显示音乐播放器入口
	showInNavbar: true,

	// 是否在侧边栏显示音乐播放器组件
	showInSidebar: true,

	// 使用方式："meting" 使用 Meting API，"local" 使用本地音乐列表
	mode: "local",

	// 默认音量 (0-1)
	volume: 0.7,

	// 播放模式：'list'=列表循环, 'one'=单曲循环, 'random'=随机播放
	playMode: "list",

	// 是否显启用歌词
	showLyrics: false,

	// Meting API 配置
	meting: {
		// Meting API 地址
		// 默认使用官方 API，也可以使用自定义 API
		api: "https://api.i-meto.com/meting/api?server=:server&type=:type&id=:id&r=:r",
		// 音乐平台：netease=网易云音乐, tencent=QQ音乐, kugou=酷狗音乐, xiami=虾米音乐, baidu=百度音乐
		server: "netease",
		// 类型：song=单曲, playlist=歌单, album=专辑, search=搜索, artist=艺术家
		type: "playlist",
		// 歌单/专辑/单曲 ID 或搜索关键词
		id: "10046455237",
		// 认证 token（可选）
		auth: "",
		// 备用 API 配置（当主 API 失败时使用）
		fallbackApis: [
			"https://api.injahow.cn/meting/?server=:server&type=:type&id=:id",
			"https://api.moeyao.cn/meting/?server=:server&type=:type&id=:id",
		],
	},

	// 本地音乐配置（当 mode 为 'local' 时使用）
	// 1. 支持传入歌词文件的路径
	// lrc: "/assets/music/lrc/使一颗心免于哀伤-哼唱.lrc",
	// 2. 或者直接填入歌词字符串内容
	// lrc: "[00:00.00]歌词内容...",
	local: {
		playlist: [
			{
				name: "Believe Me",
				artist: "阿保剛",
				url: "https://ik.imagekit.io/hikari4ever/Blog/Music/%E9%98%BF%E4%BF%9D%E5%89%9B%20-%20Believe%20Me.mp3?updatedAt=1791469543400",
				cover: "https://ik.imagekit.io/hikari4ever/Blog/Music/Cover/%E9%98%BF%E4%BF%9D%E5%89%9B%20-%20Believe%20Me.jpg",
				lrc: "",
			},
			{
				name: "自由の時間",
				artist: "出羽良彰",
				url: "https://ik.imagekit.io/hikari4ever/Blog/Music/%E5%87%BA%E7%BE%BD%E8%89%AF%E5%BD%B0%20-%20%E8%87%AA%E7%94%B1%E3%81%AE%E6%99%82%E9%96%93.mp3?updatedAt=1791468893795",
				cover: "https://ik.imagekit.io/hikari4ever/Blog/Music/Cover/%E5%87%BA%E7%BE%BD%E8%89%AF%E5%BD%B0%20-%20%E8%87%AA%E7%94%B1%E3%81%AE%E6%99%82%E9%96%93.jpg?updatedAt=1791468915013",
				lrc: "",
			},

			{
				name: "「暦お兄ちゃん」",
				artist: "神前暁",
				url: "https://ik.imagekit.io/hikari4ever/Blog/Music/%E7%A5%9E%E5%89%8D%E6%9A%81%20-%20_%E6%9A%A6%E3%81%8A%E5%85%84%E3%81%A1%E3%82%83%E3%82%93_.mp3?updatedAt=1791468892238",
				cover: "https://ik.imagekit.io/hikari4ever/Blog/Music/Cover/%E7%A5%9E%E5%89%8D%E6%9A%81%20-%20_%E6%9A%A6%E3%81%8A%E5%85%84%E3%81%A1%E3%82%83%E3%82%93_.jpg?updatedAt=1791468913974",
				lrc: "",
			},
			{
				name: "深窓の令嬢",
				artist: "神前暁",
				url: "https://ik.imagekit.io/hikari4ever/Blog/Music/%E7%A5%9E%E5%89%8D%E6%9A%81%20-%20%E6%B7%B1%E7%AA%93%E3%81%AE%E4%BB%A4%E5%AC%A2.mp3?updatedAt=1791468894460",
				cover: "https://ik.imagekit.io/hikari4ever/Blog/Music/Cover/%E7%A5%9E%E5%89%8D%E6%9A%81%20-%20%E6%B7%B1%E7%AA%93%E3%81%AE%E4%BB%A4%E5%AC%A2.jpg?updatedAt=1791468914145",
				lrc: "",
			},
			{
				name: "『友達』",
				artist: "出羽良彰",
				url: "https://ik.imagekit.io/hikari4ever/Blog/Music/%E5%87%BA%E7%BE%BD%E8%89%AF%E5%BD%B0%20-%20_%E5%8F%8B%E9%81%94_.mp3?updatedAt=1791468891814",
				cover: "https://ik.imagekit.io/hikari4ever/Blog/Music/Cover/%E5%87%BA%E7%BE%BD%E8%89%AF%E5%BD%B0%20-%20_%E5%8F%8B%E9%81%94_.jpg?updatedAt=1791468913965",
				lrc: "",
			},
			{
				name: "殺風景",
				artist: "神前暁",
				url: "https://ik.imagekit.io/hikari4ever/Blog/Music/%E7%A5%9E%E5%89%8D%E6%9A%81%20-%20%E6%AE%BA%E9%A2%A8%E6%99%AF.mp3?updatedAt=1791468893818",
				cover: "https://ik.imagekit.io/hikari4ever/Blog/Music/Cover/%E7%A5%9E%E5%89%8D%E6%9A%81%20-%20%E6%AE%BA%E9%A2%A8%E6%99%AF.jpg?updatedAt=1791468914195",
				lrc: "",
			},
		],
	},
};
