import fs from 'fs'
import path from 'path'

const roots = [path.join(process.cwd(), 'src/features/launcher/components/addGames')]
const extraFiles = [
  path.join(process.cwd(), 'src/features/launcher/hooks/useLauncherController.tsx'),
  path.join(process.cwd(), 'src/styles/launcher.css'),
]

function isUtf16Le(buf) {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return true
  }

  return buf.length >= 4 && buf[1] === 0 && buf[3] === 0
}

function convertFile(filePath) {
  const buf = fs.readFileSync(filePath)
  if (isUtf16Le(buf)) {
    const text = buf[0] === 0xff && buf[1] === 0xfe
      ? buf.toString('utf16le').slice(1)
      : buf.toString('utf16le')
    fs.writeFileSync(filePath, text, 'utf8')
    console.log('converted', path.relative(process.cwd(), filePath))
    return
  }
  console.log('ok', path.relative(process.cwd(), filePath))
}

for (const dir of roots) {
  for (const file of fs.readdirSync(dir)) {
    if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      convertFile(path.join(dir, file))
    }
  }
}

for (const filePath of extraFiles) {
  if (fs.existsSync(filePath)) {
    convertFile(filePath)
  }
}
