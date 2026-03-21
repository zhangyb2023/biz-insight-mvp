import type { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: "/workbench",
    permanent: false
  }
});

export default function SourcesRedirectPage() {
  return null;
}
