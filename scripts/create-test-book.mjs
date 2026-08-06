import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import AdmZip from 'adm-zip'

const bookDir = join(import.meta.dirname, '..', 'public')
const tempDir = join(import.meta.dirname, '.epub-temp')

function ch(title, body) {
  return '<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-CN" lang="zh-CN">\n<head><meta charset="UTF-8" /><title>' + title + '</title></head>\n<body><h2>' + title + '</h2>' + body + '</body>\n</html>'
}

const c1 = ch('第一章 抵达',
  '<p>夜幕低垂时，林默踏入了这座藏在山谷中的小镇。</p>' +
  '<p>青石板路两侧，木屋歪斜地挤在一起，烛光从窗缝里漏出来。一个佝偻的身影坐在路边的石墩上，手中捻着一串发光的珠子。老人的头发雪白，脸上沟壑纵横，像一张揉皱的旧地图。</p>' +
  '<p>"年轻人，天黑了还在赶路？"老人的声音干涩，像风刮过枯叶。</p>' +
  '<p>林默拱手行礼，斗笠上的尘土簌簌落下。"我迷路了，想找个地方歇一晚。"</p>' +
  '<p>老人抬起头，浑浊的眼睛在烛光中闪了一下。她自称姓苏，镇上的人都叫她苏婆婆。</p>' +
  '<p>"镇上只有观星台那边有空房。不过——"她顿了顿，枯瘦的手指停止捻动珠子，"晚上别出门。星萤要出来了。"</p>' +
  '<p>"星萤？"林默从未听过这个词。</p>' +
  '<p>苏婆婆没有直接回答。她缓缓站起身来，佝偻的影子在烛光中拉得很长。</p>' +
  '<p>"你今晚先住下。明天天亮了，我再跟你细说。记住我的话——夜里不管听到什么声音，都不要出门，不要开窗。"</p>' +
  '<p>林默点了点头，心中却涌起一阵不安。这座小镇太安静了，安静得不像有人居住。</p>' +
  '<p>苏婆婆领着他穿过狭窄的青石巷，两旁的木屋里偶尔透出一丝烛光，但看不到任何人影。空气中弥漫着一股若有若无的甜香，像是桂花的味道，又像是别的什么。</p>' +
  '<p>"到了。"她在一座低矮的木屋前停下，推开门，里面只有一张床、一张桌子和一盏油灯。</p>' +
  '<p>"将就一晚。"苏婆婆说完便转身离去，拐杖敲击青石板的声音渐渐消失在巷子尽头。</p>' +
  '<p>林默放下包袱，点起油灯。窗外一片漆黑，连月亮都没有。他躺在床上，却迟迟无法入睡。</p>' +
  '<p>不知过了多久，他听到了声音。</p>' +
  '<p>那是一种轻微的嗡鸣，像是无数细小的翅膀在扇动。声音从遥远的天际传来，渐渐变得清晰。林默坐起身，走到窗边，犹豫了一下，还是推开了一条缝。</p>' +
  '<p>他看到了此生从未见过的景象。</p>'
)

const c2 = ch('第二章 星萤',
  '<p>天空中有无数光点在移动。</p>' +
  '<p>它们不是星星。星星固定在各自的位置上，遵循亘古不变的轨迹。但这些光点在聚拢、散开、旋转——像一群无声的鱼在深海中巡游。没有固定的星座，没有规律。</p>' +
  '<p>是活的。</p>' +
  '<p>林默屏住呼吸，将窗缝推得更开了一些。那些光点有大有小，大的如拳头，小的如萤火。它们发出柔和的银蓝色光芒，将整个山谷笼罩在一片梦幻的光辉之中。</p>' +
  '<p>他本该感到恐惧。毕竟方圆百里没有人烟，整个镇子只有风声和这些不知名的光。</p>' +
  '<p>但那些光点太美了。美得不像是威胁。美得让他想起小时候躺在院子里数星星的夜晚，想起母亲说"每颗星星都是一个愿望"。</p>' +
  '<p>他发现自己的脚已经在朝门口走。</p>' +
  '<p>木门发出吱呀一声，他踏入了夜色。头顶的光河缓缓旋转，像一只巨大的眼睛在注视着他。空气很凉，带着青草和露水的气息。那些甜香更浓了。</p>' +
  '<p>观星台就在镇子的最高处。那是一座三层石塔，不知建于什么年代，灰色的石砖上爬满枯藤。林默不由自主地朝它走去。</p>' +
  '<p>木门没锁。推开时发出一声长叹，仿佛塔本身在欢迎他。旋转石阶很窄，只能容一人通过。火折子在潮湿的空气中明灭不定，墙壁上隐约可见褪色的壁画——画的是人和那些光点共舞的场景。</p>' +
  '<p>塔顶一片开阔。林默站在露台上，头顶的光河比在镇上看到的多了十倍。</p>' +
  '<p>它们密集地旋转着，形成一个缓慢的光涡。银河黯淡，月亮隐退，只剩这群不知名的光在统治夜空。那种嗡鸣声更清晰了，仿佛无数细微的歌声交织在一起。</p>' +
  '<p>然后，最亮的那一颗缓缓降下。</p>' +
  '<p>它只有拳头大小，半透明，发出银蓝色的柔光。形如一朵发光的水母——顶部是弧形的光膜，下方垂着数十条细如蚕丝的光须。它在林默眼前悬停，光膜微微搏动，像是心跳。</p>' +
  '<p>林默屏住呼吸。光须轻轻扫过他的脸颊，带来一阵微麻的凉意。</p>' +
  '<p>然后它碰了碰他的额头。</p>'
)

const c3 = ch('第三章 守护',
  '<p>画面涌入林默的脑海。</p>' +
  '<p>千年前的星砂镇。孩子们在青石巷里奔跑，头顶是密集的星萤，像一条永不停歇的光河。人们在观星台上与星萤共舞，光须触碰额头时，记忆与梦境在彼此之间流淌。</p>' +
  '<p>它们不吃食物，只饮星光。它们不守护什么秘密——它们守护的是人类仰望星空时心底的那份颤栗。</p>' +
  '<p>一代又一代，星萤见证了这座小镇的兴衰。从繁华到衰落，从喧嚣到沉寂。它们始终在那里，在每一个晴朗的夜晚，用微弱的光照亮这片山谷。</p>' +
  '<p>画面消退了。林默睁开眼睛，发现自己躺在观星台的台阶上。</p>' +
  '<p>手心发热——他摊开手掌，一颗微微发光的珠子静静地躺在掌心，和苏婆婆手中那串一模一样。</p>' +
  '<p>身后传来拐杖敲击青石板的声音。</p>' +
  '<p>苏婆婆站在晨雾里。晨光从山谷缺口处涌入，头顶的星萤一颗接一颗熄灭，退回看不见的地方。</p>' +
  '<p>她朝他笑了笑，露出残缺的牙齿。"看来它们喜欢你。"</p>' +
  '<p>她晃了晃手腕上那串珠子——二十几颗，每一颗都泛着微弱的光。"我在这个镇子上住了五十年，才攒到这些。你第一晚就得了一颗。"</p>' +
  '<p>林默低头看着掌心的珠子。它散发着温热的微光，像是星萤留下的一份礼物。</p>' +
  '<p>"婆婆，"他说，"观星台那些空房，能租给我一间吗？"</p>' +
  '<p>苏婆婆笑了，皱纹在晨光中舒展开来。</p>' +
  '<p>"当然可以。不过——"她转过身，朝镇子里走去，"你得学学怎么泡茶。我一个人已经喝了太多年了。"</p>' +
  '<p>林默跟在她身后，掌心的珠子在晨光中慢慢变得透明。但他知道，天黑之后它还会再亮起来。就像头顶那些看不见的星萤，它们从未离开。</p>'
)

const containerXML = '<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n  <rootfiles>\n    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>\n  </rootfiles>\n</container>'

const contentOPF = '<?xml version="1.0" encoding="UTF-8"?>\n<package version="3.0" unique-identifier="book-id" xmlns="http://www.idpf.org/2007/opf">\n  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n    <dc:title>星砂镇</dc:title>\n    <dc:creator>AI 创作</dc:creator>\n    <dc:language>zh-CN</dc:language>\n    <dc:identifier id="book-id">test-book-star-sand-town</dc:identifier>\n  </metadata>\n  <manifest>\n    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>\n    <item id="chapter2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>\n    <item id="chapter3" href="chapter3.xhtml" media-type="application/xhtml+xml"/>\n    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>\n  </manifest>\n  <spine>\n    <itemref idref="chapter1"/>\n    <itemref idref="chapter2"/>\n    <itemref idref="chapter3"/>\n  </spine>\n</package>'

const navXHTML = '<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-CN" lang="zh-CN">\n<head><meta charset="UTF-8" /><title>目录</title></head>\n<body>\n  <nav xmlns:epub="http://www.idpf.org/2007/ops" epub:type="toc">\n    <h1>目录</h1>\n    <ol>\n      <li><a href="chapter1.xhtml">第一章 抵达</a></li>\n      <li><a href="chapter2.xhtml">第二章 星萤</a></li>\n      <li><a href="chapter3.xhtml">第三章 守护</a></li>\n    </ol>\n  </nav>\n</body>\n</html>'

console.log('Creating EPUB...')
rmSync(tempDir, { recursive: true, force: true })
mkdirSync(join(tempDir, 'META-INF'), { recursive: true })
mkdirSync(join(tempDir, 'OEBPS'), { recursive: true })

writeFileSync(join(tempDir, 'mimetype'), 'application/epub+zip')
writeFileSync(join(tempDir, 'META-INF', 'container.xml'), containerXML)
writeFileSync(join(tempDir, 'OEBPS', 'content.opf'), contentOPF)
writeFileSync(join(tempDir, 'OEBPS', 'nav.xhtml'), navXHTML)
writeFileSync(join(tempDir, 'OEBPS', 'chapter1.xhtml'), c1)
writeFileSync(join(tempDir, 'OEBPS', 'chapter2.xhtml'), c2)
writeFileSync(join(tempDir, 'OEBPS', 'chapter3.xhtml'), c3)

const zip = new AdmZip()
zip.addLocalFile(join(tempDir, 'mimetype'))
zip.addLocalFile(join(tempDir, 'META-INF', 'container.xml'), 'META-INF')
zip.addLocalFile(join(tempDir, 'OEBPS', 'content.opf'), 'OEBPS')
zip.addLocalFile(join(tempDir, 'OEBPS', 'nav.xhtml'), 'OEBPS')
zip.addLocalFile(join(tempDir, 'OEBPS', 'chapter1.xhtml'), 'OEBPS')
zip.addLocalFile(join(tempDir, 'OEBPS', 'chapter2.xhtml'), 'OEBPS')
zip.addLocalFile(join(tempDir, 'OEBPS', 'chapter3.xhtml'), 'OEBPS')

const epubPath = join(bookDir, 'test-book.epub')
zip.writeZip(epubPath)

rmSync(tempDir, { recursive: true, force: true })
console.log('EPUB created at', epubPath)
