import Head from 'next/head';
import BackgroundRemover from '../components/BackgroundRemover';

export default function Home() {
  return (
    <>
      <Head>
        <title>Free Background Remover - Unlimited Usage</title>
        <meta name="description" content="Remove image backgrounds for free with unlimited usage using TensorFlow.js" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main>
        <BackgroundRemover />
      </main>
    </>
  );
}
