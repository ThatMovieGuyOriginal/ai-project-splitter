import type { AppProps } from 'next/app'
import Head from 'next/head'
import '../styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>LLM Index Analyzer</title>
        <meta name="description" content="Private, secure codebase analysis and LLM context optimization." />
      </Head>
      <Component {...pageProps} />
    </>
  )
}
