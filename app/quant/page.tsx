"use client";

import Link from "next/link";
import { useEffect } from "react";
import { getOptionsChain } from "./actions";

export default function Home() {
  useEffect(() => {
    const fetchData = async () => {
      const fullOptionChain = await getOptionsChain("I:SPX");
      console.log(fullOptionChain);
    };
    fetchData();
  }, []);

  return (
    <div className="relative h-screen">
      <div className="absolute inset-0 bg-[url('/wp.png')] bg-cover bg-center bg-no-repeat opacity-15 z-0"></div>
      <div className="relative z-10 font-sans flex flex-col gap-4 mx-12 sm:mx-32 h-full">
        <div className="flex font-medium items-center justify-center pt-10 pb-8 border-b border-gray-400">
          <Link href="/" className="hover:underline">
            <h1 className="text-2xl">vovonacci@PJT</h1>
          </Link>
        </div>
        <div>
          <p>oi</p>
        </div>
      </div>
    </div>
  );
}
