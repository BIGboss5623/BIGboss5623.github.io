#!/usr/bin/env python3
"""一键保存网站版本、生成本地留档并上传到 GitHub。"""

from __future__ import annotations

import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parent
ARCHIVE_DIR = ROOT / "本地留档"


def git(*args: str, check: bool = True, capture: bool = False) -> subprocess.CompletedProcess[str]:
    """在网站目录中运行 Git，并保持登录提示可见。"""
    return subprocess.run(
        ["git", "-C", str(ROOT), *args],
        check=check,
        text=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
        errors="replace",
    )


def pause() -> None:
    if sys.stdin.isatty():
        input("\n按回车键关闭窗口……")


def fail(message: str) -> None:
    print(f"\n失败：{message}")
    pause()
    raise SystemExit(1)


def main() -> None:
    print(f"网站目录：{ROOT}")
    print("准备保存版本并上传到 GitHub……\n")

    if shutil.which("git") is None:
        fail("没有找到 Git，请先安装 Git for Windows。")

    if git("rev-parse", "--is-inside-work-tree", check=False, capture=True).returncode != 0:
        fail("当前文件夹不是 Git 仓库。")

    remote = git("remote", "get-url", "origin", check=False, capture=True)
    if remote.returncode != 0:
        fail("没有找到名为 origin 的 GitHub 远程仓库。")
    print(f"远程仓库：{remote.stdout.strip()}")

    conflicts = git("diff", "--name-only", "--diff-filter=U", capture=True).stdout.strip()
    if conflicts:
        fail("存在尚未处理的冲突，请先处理这些文件：\n" + conflicts)

    # 本地留档不能被 git add 加入网站仓库，否则会反复上传大文件。
    exclude_file = ROOT / ".git" / "info" / "exclude"
    exclude_file.parent.mkdir(parents=True, exist_ok=True)
    exclude_rule = "/本地留档/"
    existing = exclude_file.read_text(encoding="utf-8", errors="ignore") if exclude_file.exists() else ""
    if exclude_rule not in existing.splitlines():
        with exclude_file.open("a", encoding="utf-8") as file:
            if existing and not existing.endswith("\n"):
                file.write("\n")
            file.write(exclude_rule + "\n")

    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    default_message = f"网站更新 {timestamp}"
    message = input(f"本次更新说明（直接回车使用“{default_message}”）：").strip() or default_message

    print("\n[1/4] 保存全部改动……")
    git("add", "--all")
    has_changes = git("diff", "--cached", "--quiet", check=False).returncode != 0
    if has_changes:
        committed = git("commit", "-m", message, check=False)
        if committed.returncode != 0:
            fail("创建 Git 提交失败；文件仍保留在本地。")
    else:
        print("没有发现新的文件改动，将继续同步已有提交。")

    branch = git("branch", "--show-current", capture=True).stdout.strip()
    if not branch:
        fail("当前不在普通 Git 分支上，无法自动上传。")

    print("\n[2/4] 获取 GitHub 上的最新版本……")
    pulled = git("pull", "--rebase", "origin", branch, check=False)
    if pulled.returncode != 0:
        git("rebase", "--abort", check=False)
        fail("同步远端版本失败。已保留本地提交且没有覆盖线上内容，请查看上方提示。")

    print("\n[3/4] 生成本地恢复留档……")
    ARCHIVE_DIR.mkdir(exist_ok=True)
    archive = ARCHIVE_DIR / f"{ROOT.name}_{timestamp}.bundle"
    bundled = git("bundle", "create", str(archive), "--all", check=False)
    if bundled.returncode != 0:
        fail("本地 Git 留档生成失败，因此暂不上传。")
    print(f"留档位置：{archive}")

    print("\n[4/4] 上传到 GitHub……")
    pushed = git("push", "origin", branch, check=False)
    if pushed.returncode != 0:
        fail("上传失败，但本地提交和留档都已保存；解决网络或登录问题后可再次运行。")

    print("\n完成：网站版本已保存、留档并上传到 GitHub。")
    pause()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        fail("操作已由你取消。")
    except OSError as exc:
        fail(f"系统错误：{exc}")
