export const testHtml = `<!DOCTYPE html>
<html>
  <head>
    <title>Test</title>
    <meta property="og:title" content="Test Title" />
    <meta property="og:description" content="Test Description" />
    <meta property="og:image" content="https://example.com/image.jpg" />
  </head>
  <body>
    <h1>Test</h1>
  </body>
</html>` as const;

export const correctData = {
  title: "Test Title",
  description: "Test Description",
  image: "https://example.com/image.jpg",
} as const;
