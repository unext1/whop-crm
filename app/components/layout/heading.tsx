import { H3 } from '../ui/typography';

const Heading = ({ title, description }: { title: string; description?: string }) => {
  return (
    <div className="pb-6">
      <H3>{title}</H3>
      {description && <p className="text-muted-foreground text-sm">{description}</p>}
    </div>
  );
};

export default Heading;
