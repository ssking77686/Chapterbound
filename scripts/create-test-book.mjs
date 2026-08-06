import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import AdmZip from 'adm-zip'

const bookDir = join(import.meta.dirname, '..', 'public')
const tempDir = join(import.meta.dirname, '.epub-temp')

const chapterHTML = `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-CN" lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>星砂镇</title>
</head>
<body>
  <h1>星砂镇</h1>

  <p>夜幕低垂时，林默踏入了这座藏在山谷中的小镇。</p>

  <p>青石板路两侧，木屋歪斜地挤在一起，烛光从窗缝里漏出来。一个佝偻的身影坐在路边的石墩上，手中捻着一串发光的珠子。老人的头发雪白，脸上沟壑纵横，像一张揉皱的旧地图。</p>

  <p>"年轻人，天黑了还在赶路？"老人的声音干涩，像风刮过枯叶。</p>

  <p>林默拱手行礼，斗笠上的尘土簌簌落下。"我迷路了，想找个地方歇一晚。"</p>

  <p>老人抬起头，浑浊的眼睛在烛光中闪了一下。她自称姓苏，镇上的人都叫她苏婆婆。"镇上只有观星台那边有空房。不过——"她顿了顿，"晚上别出门。星萤要出来了。"</p>

  <p>"星萤？"</p>

  <p>苏婆婆指向夜空。天色已经彻底暗了，星星一颗接一颗亮起来。"天上那些光点，不是星星。是活的。老辈人说它们守着镇子，不让外人靠近观星台。三十年前有个外乡人偏不信，深夜爬上了观星台的第三层——"她捻珠子的手停了，"再也没人见过他。"</p>

  <p>林默抬头。夜空晴朗，银河横亘天际。但那些闪烁的光点移动的方式确实不像星辰——它们聚拢、散开、旋转，像一群无声的鱼在深海中巡游。没有固定的星座，没有规律。是活的。</p>

  <p>他本该感到恐惧。毕竟方圆百里没有人烟，整个镇子只有风声和烛影。但那些光点太美了，美得不像是威胁——美得让他想起小时候躺在院子里数星星的夜晚，想起母亲说"每颗星星都是一个愿望"。</p>

  <p>他发现自己的脚已经在朝观星台的方向走。</p>

  <p>观星台是座三层石塔，不知建于什么年代，灰色的石砖上爬满枯藤。木门没锁，推开时发出一声长叹。林默沿着旋转石阶往上爬，火折子在潮湿的空气中明灭不定。</p>

  <p>塔顶一片开阔。头顶的光点比在镇上看到的多了十倍——它们密集地旋转着，形成一个缓慢的光涡。银河黯淡，月亮隐退，只剩这群不知名的光在统治夜空。</p>

  <p>最亮的那一颗缓缓降下。</p>

  <p>它只有拳头大小，半透明，发出银蓝色的柔光。形如一朵发光的水母——顶部是弧形的光膜，下方垂着数十条细如蚕丝的光须。它在林默眼前悬停，光膜微微搏动，像是心跳。</p>

  <p>林默屏住呼吸。光须轻轻扫过他的脸颊，带来一阵微麻的凉意。</p>

  <p>然后它碰了碰他的额头。</p>

  <p>画面涌入——千年前的星砂镇，孩子们在青石巷里奔跑，头顶是密集的星萤，像一条永不停歇的光河。人们在观星台上与星萤共舞，光须触碰额头时，记忆与梦境在彼此之间流淌。它们不吃食物，只饮星光。它们不守护什么秘密，它们守护的是人类仰望星空时心底的那份颤栗。</p>

  <p>天快亮时，林默发现自己躺在观星台的台阶上。手心发热——摊开，一颗微微发光的珠子，和苏婆婆手中那串一模一样。</p>

  <p>身后传来拐杖敲击青石板的声音。</p>

  <p>苏婆婆站在晨雾里，朝他笑了笑，露出残缺的牙齿。"看来它们喜欢你。"她晃了晃手腕上那串珠子——二十几颗，每一颗都泛着微弱的光。"我在这个镇子上住了五十年，才攒到这些。你第一晚就得了一颗。"</p>

  <p>晨光从山谷缺口处涌入，头顶的星萤一颗接一颗熄灭，退回看不见的地方。但林默知道，天黑之后它们还会回来。</p>

  <p>"婆婆，"他说，"观星台那些空房，能租给我一间吗？"</p>

</body>
</html>`

const containerXML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`

const contentOPF = `<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" unique-identifier="book-id" xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>星砂镇</dc:title>
    <dc:creator>AI 创作</dc:creator>
    <dc:language>zh-CN</dc:language>
    <dc:identifier id="book-id">test-book-star-sand-town</dc:identifier>
  </metadata>
  <manifest>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
  </spine>
</package>`

const navXHTML = `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-CN" lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>目录</title>
</head>
<body>
  <nav xmlns:epub="http://www.idpf.org/2007/ops" epub:type="toc">
    <h1>目录</h1>
    <ol>
      <li><a href="chapter1.xhtml">星砂镇</a></li>
    </ol>
  </nav>
</body>
</html>`

console.log('Creating EPUB...')
rmSync(tempDir, { recursive: true, force: true })
mkdirSync(join(tempDir, 'META-INF'), { recursive: true })
mkdirSync(join(tempDir, 'OEBPS'), { recursive: true })

writeFileSync(join(tempDir, 'mimetype'), 'application/epub+zip')
writeFileSync(join(tempDir, 'META-INF', 'container.xml'), containerXML)
writeFileSync(join(tempDir, 'OEBPS', 'content.opf'), contentOPF)
writeFileSync(join(tempDir, 'OEBPS', 'nav.xhtml'), navXHTML)
writeFileSync(join(tempDir, 'OEBPS', 'chapter1.xhtml'), chapterHTML)

const zip = new AdmZip()
zip.addLocalFile(join(tempDir, 'mimetype'))
zip.addLocalFile(join(tempDir, 'META-INF', 'container.xml'), 'META-INF')
zip.addLocalFile(join(tempDir, 'OEBPS', 'content.opf'), 'OEBPS')
zip.addLocalFile(join(tempDir, 'OEBPS', 'nav.xhtml'), 'OEBPS')
zip.addLocalFile(join(tempDir, 'OEBPS', 'chapter1.xhtml'), 'OEBPS')

const epubPath = join(bookDir, 'test-book.epub')
zip.writeZip(epubPath)

rmSync(tempDir, { recursive: true, force: true })
console.log('EPUB created at', epubPath)
