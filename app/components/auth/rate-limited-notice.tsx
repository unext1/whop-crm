import { AlertCircle } from 'lucide-react';
import { href, Link } from 'react-router';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';

const RateLimitedNotice = () => {
  return (
    <div className="container flex items-center justify-center min-h-screen py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
          </div>
          <CardTitle>Too Many Attempts</CardTitle>
          <CardDescription>
            For security reasons, this verification session has been locked. Please start over with a new code.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild>
            <Link to={href('/')}>Request New Code</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default RateLimitedNotice;
