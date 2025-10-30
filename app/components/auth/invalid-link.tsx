import { MessageSquareWarning } from 'lucide-react';
import { href, Link } from 'react-router';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';

const InvalidLink = () => {
  return (
    <div className="container flex items-center justify-center min-h-screen py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <MessageSquareWarning className="h-12 w-12 text-yellow-500" />
          </div>
          <CardTitle>The Link is Invalid</CardTitle>
          <CardDescription>Please check and verify the link and try again</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild>
            <Link to={href('/')}>Return Home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default InvalidLink;
