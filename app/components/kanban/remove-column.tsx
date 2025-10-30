import { Form, useSubmit } from 'react-router';
import { Button } from '../ui/button';

const RemoveColumn = ({ columnId }: { columnId: string }) => {
  const submit = useSubmit();
  return (
    <Form
      method="post"
      navigate={false}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        submit(formData, {
          navigate: false,
          method: 'post',
        });
      }}
    >
      <input type="hidden" name="columnId" value={columnId} />
      <input type="hidden" name="intent" value="removeColumn" />
      <Button variant="destructive" type="submit">
        X
      </Button>
    </Form>
  );
};

export default RemoveColumn;
