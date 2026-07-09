import { source } from '@/lib/source';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/components/mdx';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { CopyPageButton } from '@/app/components/copy-page-button';
import { readFile } from 'node:fs/promises';
import type { Metadata } from 'next';

function stripFrontmatter(raw: string): string {
  const fmMatch = raw.match(/^---\n[\s\S]*?\n---\n/);
  if (fmMatch) {
    let body = raw.slice(fmMatch[0].length);
    // Remove leading import lines (lucide-react imports etc.) for clean markdown copy
    body = body.replace(/^import\s+.*$/gm, '').replace(/^\n+/, '');
    return body.trim();
  }
  return raw.trim();
}

export default async function Page(
  props: {
    params: Promise<{ slug?: string[] }>;
  },
) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;

  let markdownContent = "";
  if (page.absolutePath) {
    try {
      const raw = await readFile(page.absolutePath, "utf-8");
      markdownContent = stripFrontmatter(raw);
    } catch {
      markdownContent = "";
    }
  }

  const markdownToCopy = `# ${page.data.title}\n\n${page.data.description ? `> ${page.data.description}\n\n` : ""}${markdownContent}`;

  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full}
    >
      <div className="flex items-center gap-2">
        <DocsTitle>{page.data.title}</DocsTitle>
        {markdownContent && <CopyPageButton markdown={markdownToCopy} />}
      </div>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(
  props: {
    params: Promise<{ slug?: string[] }>;
  },
): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
