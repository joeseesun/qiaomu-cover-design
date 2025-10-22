import { kv } from '@vercel/kv';
import { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import Link from 'next/link';

interface ShareData {
  imageUrl: string;
  title: string;
  createdAt: number;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  const data = await kv.get<ShareData>(`share:${resolvedParams.id}`);
  
  if (!data) {
    return {
      title: '分享不存在',
    };
  }
  
  return {
    title: `${data.title}-由乔木画布生成`,
    description: '使用乔木画布创建的精美海报',
    openGraph: {
      title: `${data.title}-由乔木画布生成`,
      description: '使用乔木画布创建的精美海报',
      images: [data.imageUrl],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${data.title}-由乔木画布生成`,
      description: '使用乔木画布创建的精美海报',
      images: [data.imageUrl],
    },
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const data = await kv.get<ShareData>(`share:${resolvedParams.id}`);
  
  if (!data) {
    notFound();
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* 标题区域 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            {data.title}
          </h1>
          <p className="text-gray-500 text-sm sm:text-base">
            由乔木画布生成 · {new Date(data.createdAt).toLocaleDateString('zh-CN')}
          </p>
        </div>
        
        {/* 图片区域 */}
        <div className="bg-white rounded-2xl shadow-2xl p-4 sm:p-8 mb-8">
          <div className="relative w-full" style={{ aspectRatio: '1/1' }}>
            <Image
              src={data.imageUrl}
              alt={data.title}
              fill
              className="object-contain rounded-lg"
              priority
              unoptimized
            />
          </div>
        </div>
        
        {/* CTA 按钮 */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transition shadow-lg hover:shadow-xl text-sm sm:text-base"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            创建我的海报
          </Link>
        </div>
        
        {/* 底部品牌 */}
        <div className="text-center mt-12 text-sm text-gray-400">
          Powered by 乔木画布
        </div>
      </div>
    </div>
  );
}

