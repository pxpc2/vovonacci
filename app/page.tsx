import Link from "next/link";
import { getAllPosts } from "../utils/posts";
import Image from "next/image";

export default function Home() {
  const posts = getAllPosts();
  return (
    <div className="font-sans flex flex-col gap-4 mx-12 h-screen sm:mx-32">
      <div className="flex font-medium items-center justify-center pt-10 pb-8 border-b-1 border-gray-400">
        <Link href="/" className="hover:underline">
          <h1 className="text-2xl">vovonacci@PJT</h1>
        </Link>
      </div>
      <div className="flex items-center justify-center font-light">
        <p>
          Vovonacci do Porteiro José Traders. Opero daytrade desde 2018,
          atualmente com foco em mercados futuros americanos.
          <br />
          Aqui compartilho de artigos de preparação diária e revisões de pregão.
          Sinta-se à vontade para explorar e pegar algum conhecimento. <br />
          <br />
          <b>Dúvidas boas? </b> comunique-se com nois{" "}
          <b className="text-blue-500 hover:underline">
            porteirojosetrading@gmail.com
          </b>
        </p>
      </div>
      <div className="mt-2 py-2 border-t-1 border-gray-400">
        <ul>
          {posts.map((post) => (
            <li key={post.slug} className="mb-2">
              <a
                href={`/blog/${post.slug}`}
                className="text-orange-400 text-lg hover:underline"
              >
                {post.title}
              </a>{" "}
              <span className="text-gray-400 text-lg">({post.date})</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
