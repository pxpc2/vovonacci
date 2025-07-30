// app/blog/[slug]/page.tsx
export const dynamicParams = true;

import { notFound } from "next/navigation";
import { marked } from "marked";
import { getAllPosts, getPostBySlug } from "../../../utils/posts";
import "github-markdown-css/github-markdown.css";
import Link from "next/link";

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export default async function BlogPost(props: {
  params: Promise<{ slug: string }>;
}) {
  const params = await props.params;
  const post = await getPostBySlug(params.slug);

  if (!post) return notFound();

  const html = marked.parse(post.content);

  return (
    <div>
      <div className="flex font-sans font-medium items-center justify-center mx-32 pt-10 pb-8 border-b-1 border-gray-400">
        <Link href="/" className="hover:underline">
          <h1 className="text-2xl">vovonacci@PJT</h1>
        </Link>
      </div>

      <article className="mx-12 flex flex-col items-center justify-center prose max-w-none dark:prose-invert">
        <div className="flex">
          <div className="flex flex-col py-10">
            <h1 className="text-2xl font-bold">{post.title}</h1>
            <p className="text-xl text-gray-300">{post.date}</p>
          </div>
        </div>

        <div
          className="markdown-body"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </article>
    </div>
  );
}
