#!/usr/bin/env python3
"""
抖音带货视频生成器 v2
纯 FFmpeg 实现，无需额外图片处理工具
"""

import subprocess
import os
import sys
import textwrap
from pathlib import Path
from datetime import datetime

# 配置
OUTPUT_DIR = Path("./output")
TEMP_DIR = Path("./temp")
DURATION = 15  # 秒

OUTPUT_DIR.mkdir(exist_ok=True)
TEMP_DIR.mkdir(exist_ok=True)


def call_ollama(prompt: str, model: str = "deepseek-r1:8b") -> str:
    """调用 Ollama 生成文案"""
    print(f"🤖 调用 Ollama ({model}) 生成文案...")
    
    full_prompt = f"""你是一个抖音带货文案专家。请为以下产品生成一段 15 秒的带货文案。

要求：
1. 开头要有吸引力（3秒内抓住眼球）
2. 中间突出产品卖点（2-3个亮点）
3. 结尾有购买引导（限时优惠等）
4. 总字数控制在 60-100 字
5. 语言要口语化，有感染力
6. 不要用引号，直接输出文案

产品信息：{prompt}

直接输出文案："""
    
    try:
        result = subprocess.run(
            ["ollama", "run", model],
            input=full_prompt,
            capture_output=True,
            text=True,
            timeout=120
        )
        return result.stdout.strip()
    except Exception as e:
        print(f"⚠️ Ollama 调用失败: {e}")
        return None


def create_text_video(script: str, product_name: str) -> str:
    """使用 FFmpeg 创建纯文字带货视频"""
    print("🎬 开始生成视频...")
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = OUTPUT_DIR / f"douyin_video_{timestamp}.mp4"
    
    # 清理旧文件
    for f in TEMP_DIR.glob("*"):
        f.unlink()
    
    # 创建字幕
    srt_file = create_subtitle(script)
    
    # 使用 FFmpeg 创建动态文字视频
    # 视频尺寸: 1080x1920 (抖音竖屏)
    width, height = 1080, 1920
    font_size_title = 80
    font_size_main = 60
    fps = 30
    
    # 创建视频滤镜
    # 1. 创建黑色背景
    # 2. 添加标题
    # 3. 添加字幕
    
    # 由于 FFmpeg drawtext 限制，我们创建一个简单的渐变背景 + 字幕视频
    
    filter_complex = f"""
    color=c=black:s={width}x{height}:d={DURATION}:r={fps}[bg];
    [bg]drawtext=text='{product_name}':fontsize={font_size_title}:fontcolor=white:x=(w-text_w)/2:y=200:enable='between(t,0,2)':alpha=0+min(t*2,1)[v1];
    [v1]drawtext=text='{product_name}':fontsize={font_size_title}:fontcolor=white:x=(w-text_w)/2:y=200:enable='between(t,2,3)':alpha=1-max((t-2)*2,0)[v2];
    [v2]drawtext=text='点击查看详情':fontsize=40:fontcolor=gray:x=(w-text_w)/2:y=h-200:enable='between(t,{DURATION-3},{DURATION})'[out]
    """
    
    # 简化版本 - 纯色背景 + 字幕
    filter_str = f"""
    color=c=black:s={width}x{height}:d={DURATION}:r={fps}[bg];
    [bg][0:v]overlay=0:0[withsubs]
    """
    
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", f"color=c=black:size={width}x{height}:duration={DURATION}:rate={fps}",
        "-i", str(srt_file),
        "-c:v", "libx264",
        "-preset", "fast",
        "-c:s", "mov_text",
        "-metadata:s:s:0", "language=chi",
        "-pix_fmt", "yuv420p",
        "-t", str(DURATION),
        str(output_file)
    ]
    
    print(f"执行命令: {' '.join(cmd[:10])}...")
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"⚠️ 第一种方式失败，尝试备用方案...")
            return create_simple_video(script, product_name, output_file)
        
        print(f"✅ 视频生成成功: {output_file}")
        return str(output_file)
    except Exception as e:
        print(f"⚠️ 错误: {e}")
        return create_simple_video(script, product_name, output_file)


def create_simple_video(script: str, product_name: str, output_file: Path) -> str:
    """简化版视频生成"""
    print("📝 使用简化模式...")
    
    width, height = 1080, 1920
    fps = 30
    
    # 创建纯色背景视频
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", f"color=c=black:size={width}x{height}:duration={DURATION}:rate={fps}",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        str(output_file)
    ]
    
    try:
        subprocess.run(cmd, check=True, capture_output=True)
        print(f"✅ 基础视频创建成功")
        return str(output_file)
    except Exception as e:
        print(f"❌ 视频创建失败: {e}")
        return None


def create_subtitle(script: str) -> Path:
    """创建 SRT 字幕文件"""
    srt_file = TEMP_DIR / "subtitle.srt"
    
    # 清理脚本中的特殊字符
    script = script.replace("\\", "\\\\").replace("'", "\\'").replace('"', '\\"')
    
    # 将文案分段
    sentences = []
    temp = ""
    for char in script:
        temp += char
        if char in "。！？" and len(temp) > 5:
            sentences.append(temp.strip())
            temp = ""
    if temp.strip():
        sentences.append(temp.strip())
    
    if not sentences:
        sentences = [script]
    
    # 平均分配时间
    num_sentences = len(sentences)
    time_per_sentence = DURATION / num_sentences
    
    with open(srt_file, "w", encoding="utf-8") as f:
        for i, sentence in enumerate(sentences):
            start_ms = int(i * time_per_sentence * 1000)
            end_ms = int((i + 1) * time_per_sentence * 1000)
            
            start = ms_to_srt_time(start_ms)
            end = ms_to_srt_time(end_ms)
            
            # 清理字幕文本
            clean_sentence = sentence.replace("\n", " ").strip()
            
            f.write(f"{i+1}\n")
            f.write(f"{start} --> {end}\n")
            f.write(f"{clean_sentence}\n\n")
    
    print(f"📄 字幕文件已创建: {srt_file}")
    return srt_file


def ms_to_srt_time(ms: int) -> str:
    """毫秒转 SRT 时间格式"""
    seconds = ms // 1000
    milliseconds = ms % 1000
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{milliseconds:03d}"


def main():
    print("=" * 50)
    print("🎬 抖音带货视频生成器 v2")
    print("=" * 50)
    
    # 获取产品信息
    product = input("\n📦 请输入产品名称/描述: ").strip()
    if not product:
        product = "高品质保温杯"
    
    # 生成文案
    print("\n" + "-" * 40)
    script = call_ollama(product)
    
    if script:
        print("\n📝 生成的文案:")
        print("-" * 40)
        print(script)
        print("-" * 40)
    else:
        script = "这款产品真是太棒了！赶紧下单，现在购买还有优惠！限时特价，错过不再有！"
        print(f"\n⚠️ 使用默认文案")
    
    # 生成视频
    print("\n" + "-" * 40)
    output = create_text_video(script, product)
    
    if output:
        print(f"\n🎉 完成！")
        print(f"📁 视频: {output}")
        print(f"📁 字幕: {TEMP_DIR}/subtitle.srt")
    else:
        print("\n❌ 视频生成失败")
        sys.exit(1)


if __name__ == "__main__":
    main()
