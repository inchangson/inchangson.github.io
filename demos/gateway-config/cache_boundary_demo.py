#!/usr/bin/env python3
"""Learning model only: second-resolution mtime keys and non-atomic cache misses.

Run from the blog checkout: python3 demos/gateway-config/cache_boundary_demo.py
No Spring, broker, network, production data, or benchmark is involved.
"""

import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Barrier, Lock


def mtime_demo(directory):
    target = Path(directory) / "demo.properties"
    base_ns = 1_800_000_000_000_000_000
    cache = {}

    def write(version, mtime_ns):
        target.write_text(f"version={version}\n", encoding="utf-8")
        os.utime(target, ns=(mtime_ns, mtime_ns))
        assert target.stat().st_mtime_ns // 1_000_000_000 == mtime_ns // 1_000_000_000

    def find_one():
        key = ("demo", "local", target.stat().st_mtime_ns // 1_000_000_000)
        if key not in cache:
            cache[key] = int(target.read_text(encoding="utf-8").strip().split("=")[1])
        return cache[key]

    write(1, base_ns + 100_000_000)
    assert find_one() == 1
    write(2, base_ns + 100_000_000)
    same_mtime = find_one()
    write(2, base_ns + 900_000_000)
    same_second = find_one()
    write(2, base_ns + 2_000_000_000)
    next_second = find_one()
    assert (same_mtime, same_second, next_second) == (1, 1, 2)
    print(f"same_mtime: {same_mtime}")
    print(f"same_second: {same_second}")
    print(f"next_second: {next_second}")


def concurrent_miss_demo():
    cache = {}
    map_lock = Lock()
    both_missed = Barrier(2, timeout=5)
    loads = 0

    def find_one():
        nonlocal loads
        # Individual map accesses are locked; the entire read/load/write is not.
        with map_lock:
            cached = cache.get("same-key")
        if cached is not None:
            return cached
        # Force the possible interleaving instead of relying on scheduler luck.
        both_missed.wait()
        with map_lock:
            loads += 1
        value = 1  # Simplified delegate result.
        with map_lock:
            cache["same-key"] = value
        return value

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: find_one(), range(2)))
    assert results == [1, 1] and loads == 2
    print(f"concurrent_miss_loads: {loads}")


if __name__ == "__main__":
    with TemporaryDirectory(prefix="gateway-config-learning-") as directory:
        mtime_demo(directory)
    concurrent_miss_demo()
